import { SmtpClient, log } from "../deps.ts";
import { EMailTemplate, RestartMailContext } from "./templates.ts";
import { DockerContainerEvent } from "./docker-api.ts";

import * as env from "./env.ts";
import { throttle, wait } from "./async.ts";

export type RestartInfo = Omit<RestartMailContext, "hostname">;


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

export abstract class Notifier {
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

    constructor(
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
        this.notify_about_events();
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
        await wait(time_until_next_send * 1000);
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

    async notify_about_events(): Promise<void> {
        this.buffered_events = [];
        await this.update_wal();
    }

    abstract notify_about_restart(restart_info: RestartInfo): Promise<void>;

    protected static get logger() { return log.getLogger("notifier"); }
    static try_create(_: string): Notifier | undefined { throw new Error(`${this.name} does not implement try_create()`); }
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

    constructor(
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
        super(hostname, backoff_settings);
    }

    async notify_about_events() {
        const mail = new EMailTemplate("event.eta");
        await mail.render({
            hostname: this.hostname,
            earliest_next_update: new Date(),
            events: this.buffered_events
        });
        await this.send_email(mail);
        await super.notify_about_events();
    }

    async notify_about_restart(restart_info: RestartInfo) {
        const mail = new EMailTemplate("restart.eta");
        await mail.render({
            hostname: this.hostname,
            ...restart_info
        });
        await this.send_email(mail);
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


    private async send_email(mail: EMailTemplate) {
        const client = await this.connect();
        await this.recipients.map(async recipient => {

            SmtpNotifier.logger.info(`sending mail to ${recipient} via SMTP Notifier`);
            await client.send({
                content: mail.text,
                html: mail.html,
                subject: mail.subject,
                from: this.sender,
                to: recipient,
            });
            null;
        });
        await client.close();
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
        return new this(hostname, undefined, smtp_sender, recipients, use_ssl, smtp_hostname, smtp_port, smtp_username, smtp_password);
    }
}

export const ALL_NOTIFIERS: typeof Notifier[] = [SmtpNotifier];
