import { SmtpClient } from "../deps.ts";
import { log } from "../deps.ts";
import { EMailTemplate } from "../templates/templates.ts";
import { DockerContainerEvent } from "./docker-api.ts";

import * as env from "./env.ts";

export abstract class Notifier {
    constructor(
        protected hostname: string,
        ..._args: unknown[]
    ) { }
    abstract add_event(event: DockerContainerEvent): void;

    static try_create(_: string): Notifier | undefined { throw new Error(`${this.name} does not implement try_create()`); }
    static get logger() { return log.getLogger("notifier"); }
}

/**
 * Notifier to send EMails via SMTP
 *
 * this notifier can be configured using the following environment variables
 *
 * SMTP_HOSTNAME: string (required to enable the notifier)
 * SMTP_PORT: number? (optional, uses default ports depending on SMTP_USETLS)
 * SMTP_USERNAME: string? (optional)
 * SMTP_PASSWORD: string? (optional)
 * SMTP_USETLS: boolean? (optional, default false)
 * SMTP_FROM: string? (optional, defaults to dolce@<hostname>)
 */
export class SmtpNotifier extends Notifier {
    private client = new SmtpClient({ content_encoding: "base64" });
    private buffered_events: DockerContainerEvent[] = [];

    constructor(
        hostname: string,
        private sender: string,
        private recipients: string[],
        private use_ssl: boolean,
        private smtp_hostname: string,
        private smtp_port?: number,
        private smtp_username?: string,
        private smtp_password?: string,
    ) {
        super(hostname);
    }

    add_event(event: DockerContainerEvent): void {
        this.buffered_events.push(event);
    }

    private async connect() {
        const connection_config = {
            hostname: this.smtp_hostname,
            port: this.smtp_port,
            username: this.smtp_username,
            password: this.smtp_password
        };
        if (this.use_ssl) {
            await this.client.connectTLS(connection_config);
        } else {
            await this.client.connect(connection_config);
        }
    }

    private async send_email() {
        const mail = new EMailTemplate("event.eta");
        await mail.render({
            hostname: this.hostname,
            earliest_next_update: new Date(),
            events: this.buffered_events
        });

        this.recipients.forEach(async (recipient) =>
            await this.client.send({
                content: mail.text,
                html: mail.html,
                subject: mail.subject,
                from: this.sender,
                to: recipient,
            })
        );
    }

    static try_create(hostname: string): Notifier | undefined {
        SmtpNotifier.logger.debug("trying to create SMTP Notifier");
        if (!env.ensure_defined("SMTP_HOSTNAME", "SMTP_RECIPIENTS")) {
            SmtpNotifier.logger.debug("SMTP_HOSTNAME or SMTP_RECIPIENTS not set, skipping creation");
            return undefined;
        }

        const smtp_sender = env.get_string("SMTP_FROM", `dolce@${hostname}`);
        const recipients = env.get_array("SMTP_RECIPIENTS");
        const use_ssl = env.get_bool("SMTP_USETLS", false);
        const smtp_hostname = env.get_string("SMTP_HOSTNAME")!;
        const smtp_port = env.get_number("SMTP_PORT");
        const smtp_username = env.get_string("SMTP_USERNAME");
        const smtp_password = env.get_string("SMTP_PASSWORD");
        SmtpNotifier.logger.info(`creating SmtpNotifier for ${smtp_username}@${smtp_hostname}`);
        return new this(hostname, smtp_sender, recipients, use_ssl, smtp_hostname, smtp_port, smtp_username, smtp_password);
    }
}

export const ALL_NOTIFIERS: typeof Notifier[] = [SmtpNotifier];
