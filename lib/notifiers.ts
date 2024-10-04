import { SmtpClient } from "./smtp.ts";
import { getLogger } from "@std/log";
import { DockerApiContainerEvent } from "./docker-api.ts";
import { CheckedConfiguration, ConfigOption } from "./env.ts";
import {
    AppriseTemplate,
    DiscordTemplate,
    EMailTemplate,
    RestartMessageContext,
    TelegramTemplate,
    TemplateClass,
} from "./templates.ts";
import { DockerStateChangeEvent } from "./event_registry.ts";
import { TimeWindow } from "./chrono.ts";

export type RestartInfo = Omit<RestartMessageContext, "hostname">;

export abstract class Notifier {
    public constructor(protected message_class: TemplateClass, protected hostname: string) {}

    async notify_about_events(events: DockerApiContainerEvent[], earliest_next_update: Date) {
        const message = new this.message_class("event.eta");
        await message.render({
            hostname: this.hostname,
            earliest_next_update,
            events,
        });
        await this.send_message(message);
    }

    async notify_about_state_changes(state_changes: DockerStateChangeEvent[], blackout_window: TimeWindow) {
        const message = new this.message_class("state_change_after_blackout.eta");
        await message.render({
            hostname: this.hostname,
            state_changes,
            blackout_window,
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

    protected abstract send_message(_message: InstanceType<TemplateClass>): Promise<void>;

    public static get logger() {
        return getLogger("notifier");
    }
}

// this type is statisfied by all concrete implementations of the BaseNotifier class
type ConcreteNotifier = Omit<typeof Notifier, "new"> & {
    new (message_class: TemplateClass, hostname: string): Notifier;
    config: typeof CheckedConfiguration;
    message_class: TemplateClass;
};

export class SmtpNotifierConfiguration extends CheckedConfiguration {
    @ConfigOption({ env_variable: "SMTP_HOSTNAME", required: true })
    static readonly hostname: string;

    @ConfigOption({ type: Array, env_variable: "SMTP_RECIPIENTS" })
    static readonly recipients: string[] = [];

    @ConfigOption({ type: Number, env_variable: "SMTP_PORT" })
    static readonly port?: number;

    @ConfigOption({ type: Boolean, env_variable: "SMTP_USETLS" })
    static readonly use_tls: boolean = false;

    @ConfigOption({ env_variable: "SMTP_FROM" })
    static readonly sender: string = "dolce";

    @ConfigOption({ env_variable: "SMTP_USERNAME" })
    static readonly username: string;

    @ConfigOption({ env_variable: "SMTP_PASSWORD" })
    static readonly password?: string;
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
    static config = SmtpNotifierConfiguration;
    static message_class = EMailTemplate;

    private async connect(): Promise<SmtpClient> {
        const client = new SmtpClient({ content_encoding: "base64" });
        const connection_config = {
            hostname: SmtpNotifier.config.hostname,
            port: SmtpNotifier.config.port,
            username: SmtpNotifier.config.username,
            password: SmtpNotifier.config.password,
        };
        if (SmtpNotifier.config.use_tls) {
            await client.connect_tls(connection_config);
        } else {
            await client.connect_plain(connection_config);
        }
        return client;
    }

    protected async send_message(message: EMailTemplate) {
        const send_promises = SmtpNotifier.config.recipients.map(async (recipient) => {
            SmtpNotifier.logger.info(`sending mail to ${recipient} via SMTP Notifier`);
            const client = await this.connect();
            await client.send({
                content: message.text,
                html: message.html,
                subject: message.subject,
                from: SmtpNotifier.config.sender,
                to: recipient,
            });
            client.close();
        });
        await Promise.all(send_promises);
    }
}

export class DiscordNotifierConfiguration extends CheckedConfiguration {
    @ConfigOption({ env_variable: "DISCORD_WEBHOOK", required: true })
    static readonly webhook_url?: string;
}

/**
 * Notifier to send Messages via a Discord WebHook
 *
 * this notifier can be configured using the following environment variables
 *
 * DISCORD_WEBHOOK: string URL of the webhook (required to enable the notifier)
 */
class DiscordNotifier extends Notifier {
    static config = DiscordNotifierConfiguration;
    static message_class = DiscordTemplate;

    protected async send_message(message: DiscordTemplate) {
        await fetch(DiscordNotifier.config.webhook_url!, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: message.text,
        });
    }
}

export class TelegramNotifierConfiguration extends CheckedConfiguration {
    @ConfigOption({ env_variable: "TELEGRAM_HTTP_TOKEN", required: true })
    static readonly http_token: string;

    @ConfigOption({ type: Array, env_variable: "TELEGRAM_RECIPIENT_IDS" })
    static readonly recipient_ids: string[] = [];
}

/**
 * Notifier to send Messages via a the Telegram API
 *
 * this notifier can be configured using the following environment variables
 *
 * TELEGRAM_HTTP_TOKEN: string HTTP Token of your Bot
 * TELEGRAM_RECIPIENT_IDS: string[] IDs of the recipient groups/users
 */
class TelegramNotifier extends Notifier {
    static config = TelegramNotifierConfiguration;
    static message_class = TelegramTemplate;

    protected async send_message(message: TelegramTemplate) {
        const send_promises = TelegramNotifier.config.recipient_ids.map(
            async (recipient) =>
                await fetch(`https://api.telegram.org/bot${TelegramNotifier.config.http_token!}/sendMessage`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        chat_id: recipient,
                        text: message.text,
                        parse_mode: "MarkdownV2",
                    }),
                }),
        );
        await Promise.all(send_promises);
    }
}

export class AppriseNotifierConfiguration extends CheckedConfiguration {
    @ConfigOption({ env_variable: "APPRISE_HOST", required: true })
    static readonly host?: string;

    @ConfigOption({ env_variable: "APPRISE_PROTOCOL", one_of: ["http", "https"] })
    static readonly protocol: string = "http";

    @ConfigOption({ env_variable: "APPRISE_URLS", required: true })
    static readonly urls: string;

    @ConfigOption({ env_variable: "APPRISE_TAG", required: true })
    static readonly tag: string;

    @ConfigOption({ env_variable: "APPRISE_TYPE", one_of: ["info", "success", "warning", "failure"] })
    static readonly type: string = "info";
}

/**
 * Notifier to send Messages via a the Telegram API
 *
 * this notifier can be configured using the following environment variables
 *
 * TELEGRAM_HTTP_TOKEN: string HTTP Token of your Bot
 * TELEGRAM_RECIPIENT_IDS: string[] IDs of the recipient groups/users
 */
class AppriseNotifier extends Notifier {
    static config = AppriseNotifierConfiguration;
    static message_class = AppriseTemplate;

    protected async send_message(message: AppriseTemplate) {
        await fetch(`${AppriseNotifier.config.protocol}://${AppriseNotifier.config.host}/notify/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                urls: AppriseNotifier.config.urls,
                body: message.text,
                title: message.title,
                type: message.type || AppriseNotifier.config.type,
                format: message.format,
                tag: AppriseNotifier.config.tag,
            }),
        });
    }
}

export function try_create(
    notifier_class: ConcreteNotifier,
    hostname: string,
): InstanceType<ConcreteNotifier> | undefined {
    notifier_class.logger.debug(`trying to create ${notifier_class.name}`);
    if (!notifier_class.config.is_valid) {
        notifier_class.logger.debug(`${notifier_class.name} configuration invalid, skipping creation`);
        for (const error of Object.values(notifier_class.config.errors)) {
            notifier_class.logger.debug(`\t${error}`);
        }
        return undefined;
    }

    notifier_class.logger.info(`creating ${notifier_class.name}`);
    return new notifier_class(notifier_class.message_class, hostname);
}
export const ALL_NOTIFIERS: ConcreteNotifier[] = [SmtpNotifier, DiscordNotifier, TelegramNotifier, AppriseNotifier];
