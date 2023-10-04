import { DOMParser, Eta, extract_frontmatter, path } from "../deps.ts";
import { DockerContainerEvent } from "./docker-api.ts";

export type EventTemplateName = "event.eta" | "restart.eta";

export type BaseMessageContext = {
    hostname: string;
};

export type EventMessageContext = BaseMessageContext & {
    events: DockerContainerEvent[];
    earliest_next_update: Date;
};

export type RestartMessageContext = BaseMessageContext & {
    events_since_shutdown: DockerContainerEvent[];
    downtime_start: Date;
    downtime_end: Date;
};

type MessageContext = EventMessageContext | RestartMessageContext;

const this_dir = path.dirname(path.fromFileUrl(import.meta.url));

export abstract class Template {
    protected engine: Eta;
    protected is_rendered = false;
    protected text_content?: string;

    constructor(protected template_folder: string, protected template_name: EventTemplateName) {
        this.engine = new Eta({ views: path.join(this_dir, "../templates/", template_folder) });
    }

    get path(): string {
        return this.engine.resolvePath(this.template_name);
    }

    protected ensure_rendered() {
        if (!this.is_rendered) {
            throw new Error("template not rendered. Call `render()` first (and make sure you await that call)");
        }
    }

    public async render(context: MessageContext): Promise<void> {
        this.text_content = await this.engine.renderAsync(this.template_name, context);
        this.is_rendered = true;
    }

    get text(): string {
        this.ensure_rendered();
        return this.text_content!;
    }
}

// this type is statisfied by all concrete implementations of the Template class
export type ConcreteTemplate = Omit<typeof Template, "new"> & {
    new (_: EventTemplateName): Template;
};

export class SimpleTemplate extends Template {
    constructor(template_name: EventTemplateName) {
        super("simple", template_name);
    }
}

type EMailFrontMatter = { subject: string };
export class EMailTemplate extends Template {
    private html_content?: string;
    private frontmatter?: EMailFrontMatter;

    constructor(protected template_name: EventTemplateName) {
        super("email", template_name);
    }

    async render(context: MessageContext) {
        const template_path = this.path;
        const template_contents = await Deno.readTextFile(template_path);
        const { attrs, body } = extract_frontmatter<EMailFrontMatter>(template_contents);
        this.frontmatter = attrs;
        this.html_content = await this.engine.renderStringAsync(body, context);

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

export class DiscordTemplate extends Template {
    constructor(template_name: EventTemplateName) {
        super("discord", template_name);
    }
}

export class TelegramTemplate extends Template {
    constructor(template_name: EventTemplateName) {
        super("telegram", template_name);
    }
}

type AppriseFrontMatter = { title: string; format: string; type?: string };
export class AppriseTemplate extends Template {
    private frontmatter?: AppriseFrontMatter;

    constructor(template_name: EventTemplateName) {
        super("apprise", template_name);
    }

    async render(context: MessageContext) {
        const template_path = this.path;
        const template_contents = await Deno.readTextFile(template_path);
        const { attrs, body } = extract_frontmatter<AppriseFrontMatter>(template_contents);
        this.frontmatter = attrs;
        this.text_content = await this.engine.renderStringAsync(body, context);
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
