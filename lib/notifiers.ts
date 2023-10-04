import { log, SmtpClient } from "../deps.ts";
import {
    ConcreteTemplate,
    DiscordTemplate,
    EMailTemplate,
    RestartMessageContext,
    TelegramTemplate,
    Template,
} from "./templates.ts";
import { DockerContainerEvent } from "./docker-api.ts";
import { CheckedConfiguration, ConfigOption, EnvironmentConfiguration } from "./env.ts";

export type RestartInfo = Omit<RestartMessageContext, "hostname">;

export abstract class Notifier {
    public constructor(protected message_class: ConcreteTemplate, protected hostname: string) {}

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

    protected abstract send_message(_message: Template): Promise<void>;

    public static get logger() {
        return log.getLogger("notifier");
    }
}

// this type is statisfied by all concrete implementations of the BaseNotifier class
type ConcreteNotifier = Omit<typeof Notifier, "new"> & {
    new (message_class: ConcreteTemplate, hostname: string): Notifier;
    config: typeof CheckedConfiguration;
    message_class: ConcreteTemplate;
};

@EnvironmentConfiguration
export class SmtpNotifierConfiguration extends CheckedConfiguration {
    @ConfigOption({ env_variable: "SMTP_HOSTNAME", required: true })
    static readonly hostname: string;

    @ConfigOption({ env_variable: "SMTP_RECIPIENTS", required: true })
    static readonly recipients: string[] = [];

    @ConfigOption({ env_variable: "SMTP_PORT" })
    static readonly port?: number;

    @ConfigOption({ env_variable: "SMTP_USETLS" })
    static readonly use_tls: boolean = false;

    @ConfigOption({ env_variable: "SMTP_FROM" })
    static readonly sender: string = "dolce";

    @ConfigOption({ env_variable: "SMTP_USERNAME" })
    static readonly username?: string;

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
            await client.connectTLS(connection_config);
        } else {
            await client.connect(connection_config);
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
            await client.close();
        });
        await Promise.all(send_promises);
    }
}

@EnvironmentConfiguration
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

@EnvironmentConfiguration
export class TelegramNotifierConfiguration extends CheckedConfiguration {
    @ConfigOption({ env_variable: "TELEGRAM_HTTP_TOKEN", required: true })
    static readonly http_token?: string;

    @ConfigOption({ env_variable: "TELEGRAM_RECIPIENT_IDS" })
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
        const send_promises = TelegramNotifier.config.recipient_ids.map(async (recipient) =>
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
            })
        );
        await Promise.all(send_promises);
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
export const ALL_NOTIFIERS: ConcreteNotifier[] = [
    SmtpNotifier,
    DiscordNotifier,
    TelegramNotifier,
];
