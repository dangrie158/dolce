import { SmtpClient } from "../deps.ts";
import { log, streams } from "../deps.ts";
import { EMailTemplate, RestartMailContext } from "./templates.ts";
import { DockerContainerEvent } from "./docker-api.ts";

import * as env from "./env.ts";
import { throttle } from "./async.ts";

export type RestartInfo = Omit<RestartMailContext, "hostname">;

type WriteAheadLog = {
    buffered_events: DockerContainerEvent[];
};

export abstract class Notifier {
    private static WAL_THROTTLE_INTERVAL = 200;
    private static createion_counter = 0;

    protected buffered_events: DockerContainerEvent[] = [];
    private unique_id: number;
    private wal_file: Deno.FsFile;

    constructor(
        protected hostname: string,
        ..._args: unknown[]
    ) {
        this.unique_id = Notifier.createion_counter++;
        this.wal_file = Deno.openSync(this.wal_file_path, { read: true, write: true, create: true });
    }

    protected get wal_file_path() {
        return `/var/run/dolce/${this.constructor.name.toLowerCase()}_${this.unique_id}.wal`;
    }

    async add_event(event: DockerContainerEvent): Promise<void> {
        this.buffered_events.push(event);
        await this.update_wal_throttled();
    }

    async restore_from_wal() {
        Notifier.logger.debug(`flushing WAL ${this.wal_file_path} for notifier ${this.constructor.name} ${this.unique_id}`);
        let wal_contents: WriteAheadLog;
        try {
            wal_contents = await streams.toJson(this.wal_file.readable) as WriteAheadLog;
        } catch {
            Notifier.logger.debug(`failed to read WAL file ${this.wal_file_path}`);
            return;
        }

        this.buffered_events = wal_contents.buffered_events;
        // TODO: check if we need to send a notification
    }

    private async trancate_wal() {
        await this.wal_file.truncate();
        await Deno.fsync(this.wal_file.rid);
    }

    async update_wal() {
        const wal_contents: WriteAheadLog = {
            buffered_events: this.buffered_events
        };
        const wal_contents_string = JSON.stringify(wal_contents);
        const wal_contents_bytes = new TextEncoder().encode(wal_contents_string);
        await Deno.write(this.wal_file.rid, wal_contents_bytes);
        await Deno.fsync(this.wal_file.rid);
    }
    update_wal_throttled = throttle(async () => { await this.update_wal; }, Notifier.WAL_THROTTLE_INTERVAL);

    abstract notify_about_events(): Promise<void>;
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

    async notify_about_events() {
        const mail = new EMailTemplate("event.eta");
        await mail.render({
            hostname: this.hostname,
            earliest_next_update: new Date(),
            events: this.buffered_events
        });
        await this.send_email(mail);
    }

    async notify_about_restart(restart_info: RestartInfo) {
        const mail = new EMailTemplate("event.eta");
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
        SmtpNotifier.logger.info(`sending ${mail.constructor.name} via SMTP Notifier`);
        const client = await this.connect();
        await this.recipients.map(async (recipient) =>
            await client.send({
                content: mail.text,
                html: mail.html,
                subject: mail.subject,
                from: this.sender,
                to: recipient,
            })
        );
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
        return new this(hostname, smtp_sender, recipients, use_ssl, smtp_hostname, smtp_port, smtp_username, smtp_password);
    }
}

export const ALL_NOTIFIERS: typeof Notifier[] = [SmtpNotifier];
