import { DOMParser, Eta, extract_frontmatter, path } from "../deps.ts";
import { DockerContainerEvent } from "./docker-api.ts";

type EMailFrontMatter = { subject: string; };

type EventTemplateName = "event.eta" | "restart.eta";

type BaseMainContext = {
    hostname: string;
};

export type EventMailContext = BaseMainContext & {
    events: DockerContainerEvent[];
    earliest_next_update: Date;
};

export type RestartMailContext = BaseMainContext & {
    events_since_shutdown: DockerContainerEvent[];
    downtime_start: Date;
    downtime_end: Date;
};

type MailContext = EventMailContext | RestartMailContext;

const this_dir = path.dirname(path.fromFileUrl(import.meta.url));

export class EMailTemplate {
    static engine = new Eta({ views: path.join(this_dir, "../templates/emails") });

    private html_content?: string;
    private text_content?: string;
    frontmatter?: EMailFrontMatter;

    constructor(private template_name: EventTemplateName) { }

    private ensure_rendered() {
        if (this.html_content === undefined) {
            throw new Error("template not rendered. Call `render()` first");
        }
    }

    get path(): string {
        return EMailTemplate.engine.resolvePath(this.template_name);
    }

    async render(context: MailContext) {
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
