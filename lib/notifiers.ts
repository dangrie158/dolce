import { log, SmtpClient } from "../deps.ts";
import {
    DiscordTemplate,
    EMailTemplate,
    EventTemplateName,
    RestartMessageContext,
    SimpleTemplate,
    TelegramTemplate,
} from "./templates.ts";
import { DockerContainerEvent } from "./docker-api.ts";
import * as env from "./env.ts";

export type RestartInfo = Omit<RestartMessageContext, "hostname">;

export abstract class Notifier<MessageClass extends SimpleTemplate> {
    protected constructor(
        private message_class: { new (_: EventTemplateName): MessageClass },
        protected hostname: string,
        ..._args: unknown[]
    ) {}

    async notify_about_events(events: DockerContainerEvent[], earliest_next_update: Date) {
        const message = new this.message_class("event.eta");
        await message.render({
            hostname: this.hostname,
            earliest_next_update,
            events,
        });
        await this.send_message(message);
    }

    async notify_about_restart(restart_info: RestartInfo) {
        const message = new this.message_class("restart.eta");
        await message.render({
            hostname: this.hostname,
            ...restart_info,
        });
        await this.send_message(message);
    }

    protected abstract send_message(message: MessageClass): Promise<void>;

    protected static get logger() {
        return log.getLogger("notifier");
    }
    static try_create(_: string): Notifier<SimpleTemplate> | undefined {
        throw new Error(`${this.name} does not implement try_create()`);
    }
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
export class SmtpNotifier extends Notifier<EMailTemplate> {
    protected constructor(
        hostname: string,
        private sender: string,
        private recipients: string[],
        private use_ssl: boolean,
        private smtp_hostname: string,
        private smtp_port?: number,
        private smtp_username?: string,
        private smtp_password?: string,
    ) {
        super(EMailTemplate, hostname);
    }

    private async connect(): Promise<SmtpClient> {
        const client = new SmtpClient({ content_encoding: "base64" });
        const connection_config = {
            hostname: this.smtp_hostname,
            port: this.smtp_port,
            username: this.smtp_username,
            password: this.smtp_password,
        };
        if (this.use_ssl) {
            await client.connectTLS(connection_config);
        } else {
            await client.connect(connection_config);
        }
        return client;
    }

    protected async send_message(message: EMailTemplate) {
        const send_promises = this.recipients.map(async (recipient) => {
            SmtpNotifier.logger.info(`sending mail to ${recipient} via SMTP Notifier`);
            const client = await this.connect();
            await client.send({
                content: message.text,
                html: message.html,
                subject: message.subject,
                from: this.sender,
                to: recipient,
            });
            await client.close();
        });
        await Promise.all(send_promises);
    }

    static try_create(hostname: string): SmtpNotifier | undefined {
        SmtpNotifier.logger.debug("trying to create SMTP Notifier");
        if (!env.ensure_defined("SMTP_HOSTNAME", "SMTP_RECIPIENTS")) {
            SmtpNotifier.logger.debug("SMTP_HOSTNAME or SMTP_RECIPIENTS not set, skipping creation");
            return undefined;
        }

        const smtp_sender = env.get_string("SMTP_FROM", `dolce@${hostname}`);
        const recipients = env.get_array("SMTP_RECIPIENTS");
        const use_ssl = env.get_bool("SMTP_USETLS");
        const smtp_hostname = env.get_string("SMTP_HOSTNAME")!;
        const smtp_port = env.get_number("SMTP_PORT");
        const smtp_username = env.get_string("SMTP_USERNAME");
        const smtp_password = env.get_string("SMTP_PASSWORD");

        if (recipients.length === 0) {
            TelegramNotifier.logger.warning("SMTP_HOSTNAME set but SMTP_RECIPIENTS is empty");
        }

        SmtpNotifier.logger.info(`creating SmtpNotifier for ${smtp_username}@${smtp_hostname}`);
        return new this(
            hostname,
            smtp_sender,
            recipients,
            use_ssl,
            smtp_hostname,
            smtp_port,
            smtp_username,
            smtp_password,
        );
    }
}

/**
 * Notifier to send Messages via a Discord WebHook
 *
 * this notifier can be configured using the following environment variables
 *
 * DISCORD_WEBHOOK: string URL of the webhook (required to enable the notifier)
 */
class DiscordNotifier extends Notifier<DiscordTemplate> {
    protected constructor(
        hostname: string,
        private webhook_url: string,
    ) {
        super(DiscordTemplate, hostname);
    }

    protected async send_message(message: DiscordTemplate) {
        await fetch(this.webhook_url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: message.text,
        });
    }

    static try_create(hostname: string): DiscordNotifier | undefined {
        DiscordNotifier.logger.debug("trying to create DiscordNotifier");
        if (!env.ensure_defined("DISCORD_WEBHOOK")) {
            DiscordNotifier.logger.debug("DISCORD_WEBHOOK not set, skipping creation");
            return undefined;
        }

        const webhook_url = env.get_string("DISCORD_WEBHOOK")!;
        DiscordNotifier.logger.info("creating DiscordNotifier");
        return new this(hostname, webhook_url);
    }
}

/**
 * Notifier to send Messages via a the Telegram API
 *
 * this notifier can be configured using the following environment variables
 *
 * TELEGRAM_HTTP_TOKEN: string HTTP Token of your Bot
 * TELEGRAM_RECIPIENT_IDS: string[] IDs of the recipient groups/users
 */
class TelegramNotifier extends Notifier<TelegramTemplate> {
    protected constructor(
        hostname: string,
        private http_token: string,
        private recipient_ids: string[],
    ) {
        super(TelegramTemplate, hostname);
    }

    protected async send_message(message: TelegramTemplate) {
        const send_promises = this.recipient_ids.map(async (recipient) =>
            await fetch(`https://api.telegram.org/bot${this.http_token}/sendMessage`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    chat_id: recipient,
                    text: message.text,
                    parse_mode: "MarkdownV2",
                }),
            })
        );
        await Promise.all(send_promises);
    }

    static try_create(hostname: string): TelegramNotifier | undefined {
        TelegramNotifier.logger.debug("trying to create TelegramNotifier");
        if (!env.ensure_defined("TELEGRAM_HTTP_TOKEN", "TELEGRAM_RECIPIENT_IDS")) {
            TelegramNotifier.logger.debug("TELEGRAM_HTTP_TOKEN or TELEGRAM_RECIPIENT_IDS not set, skipping creation");
            return undefined;
        }

        const http_token = env.get_string("TELEGRAM_HTTP_TOKEN")!;
        const recipient_ids = env.get_array("TELEGRAM_RECIPIENT_IDS")!;
        if (recipient_ids.length === 0) {
            TelegramNotifier.logger.warning("TELEGRAM_HTTP_TOKEN set but TELEGRAM_RECIPIENT_IDS is empty");
        }
        TelegramNotifier.logger.info("creating TelegramNotifier");
        return new this(hostname, http_token, recipient_ids);
    }
}

export const ALL_NOTIFIERS = [SmtpNotifier, DiscordNotifier, TelegramNotifier];
