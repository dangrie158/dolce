import * as front_matter from "@std/front-matter";
import * as path from "@std/path";
import { DOMParser } from "@b-fuze/deno-dom";
import { Eta, type Options as EtaOptions } from "eta";
import { DockerApiContainerEvent } from "./docker-api.ts";
import { Configuration } from "../configuration.ts";
import { resolvePath as resolve_template_path } from "eta/file-handling";
import { DockerStateChangeEvent } from "./event_registry.ts";
import { TimeWindow } from "./chrono.ts";
export type EventTemplateName = "event.eta" | "restart.eta" | "state_change_after_blackout.eta";

export type BaseMessageContext = {
    hostname: string;
};

export type EventMessageContext = BaseMessageContext & {
    events: DockerApiContainerEvent[];
    earliest_next_update: Date;
};

export type StateChangeAfterBlackoutMessageContext = BaseMessageContext & {
    state_changes: DockerStateChangeEvent[];
    blackout_window: TimeWindow;
};

export type RestartMessageContext = BaseMessageContext & {
    events_since_shutdown: DockerApiContainerEvent[];
    downtime_start: Date;
    downtime_end: Date;
};

type MessageContext<TemplateName> = TemplateName extends "event.eta" ? EventMessageContext
    : TemplateName extends "restart.eta" ? RestartMessageContext
    : TemplateName extends "state_change_after_blackout.eta" ? StateChangeAfterBlackoutMessageContext
    : never;

const this_dir = path.dirname(path.fromFileUrl(import.meta.url));

const context_functions = {
    newest_first: (event_a: DockerApiContainerEvent, event_b: DockerApiContainerEvent): number => {
        return event_b.timeNano - event_a.timeNano;
    },
    get_event_class: (event: DockerApiContainerEvent): string => {
        switch (event.Action) {
            case "start":
                return "success";
            case "die":
                return "error";
            case "kill":
                return "error";
            case "oom":
                return "error";
            case "stop":
                return "warning";
            case "pause":
                return "warning";
            case "unpause":
                return "success";
            case "health_status":
                return "warning";
            default:
                return "";
        }
    },
    get_event_symbol: (event: DockerApiContainerEvent): string => {
        switch (event.Action) {
            case "start":
                return "✅";
            case "die":
                return "❌";
            case "kill":
                return "❌";
            case "oom":
                return "❌";
            case "stop":
                return "⏹️";
            case "pause":
                return "⏸️";
            case "unpause":
                return "⏯️";
            case "health_status":
                return "❓";
            default:
                return "";
        }
    },
    get_event_style: (event: DockerApiContainerEvent): string => {
        switch (event.Action) {
            case "start":
                return "color: #3BB273;";
            case "die":
                return "color: #BA3B46;";
            case "kill":
                return "color: #BA3B46;";
            case "oom":
                return "color: #BA3B46;";
            case "stop":
                return "color: #FF9505;";
            case "pause":
                return "color: #FF9505;";
            case "unpause":
                return "color: #3BB273;";
            case "health_status":
                return "color: #FF9505;";
            default:
                return "";
        }
    },
};

class TemplateEngine extends Eta {
    constructor(private notifier_name: string) {
        super();
    }

    public resolvePath = (template_name: string, options?: Partial<EtaOptions>): string => {
        const custom_template_folder = Configuration.custom_template_path;

        let resolved_path: string;
        this.configure({ views: path.join(custom_template_folder, this.notifier_name) });
        try {
            // try to resolve the path with the custom templates dir and check if the file exists there
            resolved_path = resolve_template_path.call(this, template_name, options);
            Deno.statSync(resolved_path);
        } catch {
            this.configure({ views: path.join(this_dir, "../templates/", this.notifier_name) });
            resolved_path = resolve_template_path.call(this, template_name, options);
        }
        return resolved_path;
    };
}

export class BaseTemplate<TemplateName extends EventTemplateName = EventTemplateName> {
    protected engine: TemplateEngine;
    protected is_rendered = false;
    protected text_content?: string;

    constructor(protected template_folder: string, protected template_name: TemplateName) {
        this.engine = new TemplateEngine(template_folder);
    }

    get path(): string {
        return this.engine.resolvePath(this.template_name);
    }

    protected ensure_rendered() {
        if (!this.is_rendered) {
            throw new Error("template not rendered. Call `render()` first (and make sure you await that call)");
        }
    }

    public async render(context: MessageContext<TemplateName>): Promise<void> {
        this.text_content = await this.engine.renderAsync(this.template_name, {
            ...context,
            ...context_functions,
        });
        this.is_rendered = true;
    }

    get text(): string {
        this.ensure_rendered();
        return this.text_content!;
    }
}
export type TemplateClass = {
    new <TemplateName extends EventTemplateName>(template_name: TemplateName): BaseTemplate<TemplateName>;
};

export class SimpleTemplate<
    TemplateName extends EventTemplateName = EventTemplateName,
> extends BaseTemplate<TemplateName> {
    constructor(template_name: TemplateName) {
        super("simple", template_name);
    }
}

type EMailFrontMatter = { subject: string };
export class EMailTemplate<
    TemplateName extends EventTemplateName = EventTemplateName,
> extends BaseTemplate<TemplateName> {
    private html_content?: string;
    private frontmatter?: EMailFrontMatter;

    constructor(protected template_name: TemplateName) {
        super("email", template_name);
    }

    async render(context: MessageContext<TemplateName>) {
        const template_path = this.path;
        const template_contents = await Deno.readTextFile(template_path);
        const { attrs, body } = front_matter.extractJson<EMailFrontMatter>(template_contents);
        this.frontmatter = attrs;
        this.html_content = await this.engine.renderStringAsync(body, {
            ...context,
            ...context_functions,
        });

        const document = new DOMParser().parseFromString(this.html_content!, "text/html");
        const text_content_lines = document!.getElementsByTagName("main")[0].textContent.split("\n");

        // find the smalles number of leading whitespace excluding lines with only whitespace
        const min_prefix_length = Math.min(
            ...text_content_lines.map((line) => (line.match(/^([ |\t]*)\S/)?.[0].length ?? Infinity) - 1),
        );
        const prefix_free_content_lines = text_content_lines
            // remove the common (minimum) whitespace in front of all lines
            .map((line) => line.substring(min_prefix_length))
            // remove consecutive blank lines
            .filter((line, index, lines) => lines[index - 1]?.trim().length !== 0 || line.trim().length !== 0);

        this.text_content = prefix_free_content_lines.join("\n").trim();
        this.is_rendered = true;
    }

    get html(): string {
        this.ensure_rendered();
        return this.html_content!;
    }

    get subject(): string {
        this.ensure_rendered();
        return this.frontmatter!.subject;
    }
}

export class DiscordTemplate<
    TemplateName extends EventTemplateName = EventTemplateName,
> extends BaseTemplate<TemplateName> {
    constructor(template_name: TemplateName) {
        super("discord", template_name);
    }
}

export class TelegramTemplate<
    TemplateName extends EventTemplateName = EventTemplateName,
> extends BaseTemplate<TemplateName> {
    constructor(template_name: TemplateName) {
        super("telegram", template_name);
    }
}

type AppriseFrontMatter = { title: string; format: string; type?: string };
export class AppriseTemplate<
    TemplateName extends EventTemplateName = EventTemplateName,
> extends BaseTemplate<TemplateName> {
    private frontmatter?: AppriseFrontMatter;

    constructor(template_name: TemplateName) {
        super("apprise", template_name);
    }

    async render(context: MessageContext<TemplateName>) {
        const template_path = this.path;
        const template_contents = await Deno.readTextFile(template_path);
        const { attrs, body } = front_matter.extractJson<AppriseFrontMatter>(template_contents);
        this.frontmatter = attrs;
        this.text_content = await this.engine.renderStringAsync(body, {
            ...context,
            ...context_functions,
        });
        this.is_rendered = true;
    }

    get title(): string {
        this.ensure_rendered();
        return this.frontmatter!.title;
    }

    get type(): string | undefined {
        this.ensure_rendered();
        return this.frontmatter!.type;
    }

    get format(): string | undefined {
        this.ensure_rendered();
        return this.frontmatter!.format;
    }
}
