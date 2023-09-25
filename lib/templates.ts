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

export class Template {
    private is_rendered = false;

    constructor(protected template_name: EventTemplateName) { }

    protected ensure_rendered() {
        if (!this.is_rendered) {
            throw new Error("template not rendered. Call `render()` first");
        }
    }

    public render(_context: MessageContext): Promise<void> {
        this.is_rendered = true;
        return Promise.resolve();
    }
}

type EMailFrontMatter = { subject: string; };
export class EMailTemplate extends Template {
    private static engine = new Eta({ views: path.join(this_dir, "../templates/email") });

    private html_content?: string;
    private text_content?: string;
    private frontmatter?: EMailFrontMatter;

    get path(): string {
        return EMailTemplate.engine.resolvePath(this.template_name);
    }

    async render(context: MessageContext) {
        const template_path = this.path;
        const template_contents = await Deno.readTextFile(template_path);
        const { attrs, body } = extract_frontmatter<EMailFrontMatter>(template_contents);
        this.frontmatter = attrs;
        this.html_content = await EMailTemplate.engine.renderStringAsync(body, context);

        const document = new DOMParser().parseFromString(this.html_content!, "text/html");
        const text_content_lines = document!.getElementsByTagName("main")[0].textContent.split("\n");

        // find the smalles number of leading whitespace excluding lines with only whitespace
        const min_prefix_length = Math.min(...text_content_lines.map(line => (line.match(/^([ |\t]*)\S/)?.[0].length ?? Infinity) - 1));
        const prefix_free_content_lines = text_content_lines
            // remove the common (minimum) whitespace in front of all lines
            .map(line => line.substring(min_prefix_length))
            // remove consecutive blank lines
            .filter((line, index, lines) => lines[index - 1]?.trim().length !== 0 || line.trim().length !== 0);

        this.text_content = prefix_free_content_lines.join("\n").trim();
        await super.render(context);
    }

    get html(): string {
        this.ensure_rendered();
        return this.html_content!;
    }

    get text(): string {
        this.ensure_rendered();
        return this.text_content!;
    }

    get subject(): string {
        this.ensure_rendered();
        return this.frontmatter!.subject;
    }
}

export class DiscordTemplate extends Template {
    private static engine = new Eta({ views: path.join(this_dir, "../templates/discord") });
    private string_content?: string;

    get path(): string {
        return DiscordTemplate.engine.resolvePath(this.template_name);
    }

    async render(context: MessageContext) {
        this.string_content = await DiscordTemplate.engine.render(this.template_name, context);
        await super.render(context);
    }

    get json(): unknown[] {
        this.ensure_rendered();
        return JSON.parse(this.string_content!);
    }

    get text(): string {
        this.ensure_rendered();
        return this.string_content!;
    }
}
