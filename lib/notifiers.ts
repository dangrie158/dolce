import { SmtpClient, log } from "../deps.ts";
import { DiscordTemplate, EMailTemplate, EventTemplateName, RestartMessageContext, TelegramTemplate, Template } from "./templates.ts";
import { DockerContainerEvent } from "./docker-api.ts";

import * as env from "./env.ts";
import { throttle, wait } from "./async.ts";

export type RestartInfo = Omit<RestartMessageContext, "hostname">;


type WriteAheadLog = {
    last_delivery: number;
    backoff_iteration: number;
    buffered_events: DockerContainerEvent[];
};

type BackoffSettings = {
    min_timeout: number;
    max_timeout: number;
    multiplier: number;
    max_iteration: number;
};

function exponential_backoff(iteration: number, options: BackoffSettings) {
    return Math.floor(Math.min(options.max_timeout, options.min_timeout * (options.multiplier ** iteration)));
}

export abstract class Notifier<MessageClass extends Template> {
    private static WAL_THROTTLE_INTERVAL = 1000;
    protected static DEFAULT_BACKOFF_SETTINGS: BackoffSettings = {
        min_timeout: 10,
        max_timeout: 60 * 24 * 60,
        multiplier: 10,
        max_iteration: 4
    };

    private static creation_counter = 0;

    protected buffered_events: DockerContainerEvent[] = [];
    private last_delivery = 0;
    private is_in_backoff_cooldown = false;
    private backoff_iteration = 0;
    private unique_id: number;

    protected constructor(
        private message_class: { new(_: EventTemplateName): MessageClass; },
        protected hostname: string,
        private backoff_settings: BackoffSettings,
        ..._args: unknown[]
    ) {
        this.unique_id = Notifier.creation_counter++;
    }

    protected get wal_file_path() {
        return `/var/run/dolce/${this.constructor.name.toLowerCase()}_${this.unique_id}.wal`;
    }

    async add_event(event: DockerContainerEvent): Promise<void> {
        this.buffered_events.push(event);
        await this.update_wal_throttled();
        await this.schedule_event_delivery_if_neccessary();
    }

    async schedule_event_delivery_if_neccessary() {
        if (this.is_in_backoff_cooldown) { return; }
        if (this.buffered_events.length === 0) { return; }

        Notifier.logger.info(`sending notification about ${this.buffered_events.length} events with ${this.constructor.name}`);
        try {
            await this.notify_about_events();
        } catch (error) {
            Notifier.logger.error(`failed to send notification with ${this.constructor.name}: ${error}`);
        }
        this.last_delivery = Date.now();
        await this.update_wal();

        // schedule next delivery
        this.is_in_backoff_cooldown = true;
        const next_delay = exponential_backoff(this.backoff_iteration, this.backoff_settings);
        this.backoff_iteration = Math.min(this.backoff_iteration + 1, this.backoff_settings.max_iteration);
        await this.update_wal();
        Notifier.logger.debug(`next_delay for ${this.constructor.name}: ${next_delay}`);
        await wait(next_delay * 1000);
        this.is_in_backoff_cooldown = false;
        if (this.buffered_events.length == 0) {
            // no new messages means we can decrease the backoff iteration
            this.backoff_iteration = Math.max(0, this.backoff_iteration - 1);
        }
        this.schedule_event_delivery_if_neccessary();
    }

    async restore_from_wal() {
        Notifier.logger.debug(`restoring ${this.constructor.name} ${this.unique_id} from WAL: ${this.wal_file_path}`);
        let wal_contents: WriteAheadLog;
        try {
            wal_contents = JSON.parse(await Deno.readTextFile(this.wal_file_path)) as WriteAheadLog;
        } catch {
            Notifier.logger.debug(`failed to read WAL file ${this.wal_file_path}`);
            return;
        }

        this.buffered_events = wal_contents.buffered_events;
        this.last_delivery = wal_contents.last_delivery;
        this.backoff_iteration = wal_contents.backoff_iteration;

        let next_delivery_date = this.last_delivery + exponential_backoff(this.backoff_iteration, this.backoff_settings);
        const now = Date.now();
        while (next_delivery_date < now) {
            next_delivery_date += exponential_backoff(this.backoff_iteration, this.backoff_settings);
            this.backoff_iteration -= 1;
            if (this.backoff_iteration <= 0) { break; }
        }
        this.is_in_backoff_cooldown = true;
        Notifier.logger.info(`restored from WAL, next delivery: ${new Date(next_delivery_date).toLocaleString()}`);
        const time_until_next_send = Math.max(0, next_delivery_date - Date.now());
        await wait(time_until_next_send);
        this.is_in_backoff_cooldown = false;
        await this.schedule_event_delivery_if_neccessary();
    }

    async update_wal() {
        const wal_contents: WriteAheadLog = {
            buffered_events: this.buffered_events,
            last_delivery: this.last_delivery,
            backoff_iteration: this.backoff_iteration
        };
        const wal_contents_string = JSON.stringify(wal_contents);
        await Deno.writeTextFile(this.wal_file_path, wal_contents_string);
    }
    update_wal_throttled = throttle(async () => { await this.update_wal(); }, Notifier.WAL_THROTTLE_INTERVAL);

    async notify_about_events() {
        const message = new this.message_class("event.eta");
        await message.render({
            hostname: this.hostname,
            earliest_next_update: new Date(),
            events: this.buffered_events
        });
        await this.send_message(message);
        this.buffered_events = [];
        await this.update_wal();
    }

    async notify_about_restart(restart_info: RestartInfo) {
        const message = new this.message_class("restart.eta");
        await message.render({
            hostname: this.hostname,
            ...restart_info
        });
        await this.send_message(message);
    }

    protected abstract send_message(message: MessageClass): Promise<void>;

    protected static get logger() { return log.getLogger("notifier"); }
    static try_create(_: string): Notifier<Template> | undefined { throw new Error(`${this.name} does not implement try_create()`); }
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
        backoff_settings: BackoffSettings = Notifier.DEFAULT_BACKOFF_SETTINGS,
        private sender: string,
        private recipients: string[],
        private use_ssl: boolean,
        private smtp_hostname: string,
        private smtp_port?: number,
        private smtp_username?: string,
        private smtp_password?: string,
    ) {
        super(EMailTemplate, hostname, backoff_settings);
    }

    private async connect(): Promise<SmtpClient> {
        const client = new SmtpClient({ content_encoding: "base64" });
        const connection_config = {
            hostname: this.smtp_hostname,
            port: this.smtp_port,
            username: this.smtp_username,
            password: this.smtp_password
        };
        if (this.use_ssl) {
            await client.connectTLS(connection_config);
        } else {
            await client.connect(connection_config);
        }
        return client;
    }


    protected async send_message(message: EMailTemplate) {
        const client = await this.connect();
        const send_promises = this.recipients.map(async recipient => {
            SmtpNotifier.logger.info(`sending mail to ${recipient} via SMTP Notifier`);
            await client.send({
                content: message.text,
                html: message.html,
                subject: message.subject,
                from: this.sender,
                to: recipient,
            });
            null;
        });
        await Promise.all(send_promises);
        await client.close();
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
        return new this(hostname, undefined, smtp_sender, recipients, use_ssl, smtp_hostname, smtp_port, smtp_username, smtp_password);
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
        backoff_settings: BackoffSettings = Notifier.DEFAULT_BACKOFF_SETTINGS,
        private webhook_url: string
    ) {
        super(DiscordTemplate, hostname, backoff_settings);
    }

    protected async send_message(message: DiscordTemplate) {
        await fetch(this.webhook_url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
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
        return new this(hostname, undefined, webhook_url);
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
        backoff_settings: BackoffSettings = Notifier.DEFAULT_BACKOFF_SETTINGS,
        private http_token: string,
        private recipient_ids: string[]
    ) {
        super(TelegramTemplate, hostname, backoff_settings);
    }

    protected async send_message(message: TelegramTemplate) {
        const send_promises = this.recipient_ids.map(async recipient =>
            await fetch(`https://api.telegram.org/bot${this.http_token}/sendMessage`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    chat_id: recipient,
                    text: message.text,
                    parse_mode: "MarkdownV2"
                })
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
        return new this(hostname, undefined, http_token, recipient_ids);
    }
}

export const ALL_NOTIFIERS = [SmtpNotifier, DiscordNotifier, TelegramNotifier];
