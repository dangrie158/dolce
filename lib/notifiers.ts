import { SmtpClient } from "../deps.ts";
import { log } from "../deps.ts";
import { EMails } from "../templates/templates.ts";

import * as env from "./env.ts";

export abstract class Notifier {
    static try_create(): Notifier | undefined { throw new Error(`${this.name} does not implement try_create()`); }
    static get logger() { return log.getLogger("notifier"); }
    abstract add_event(): void;
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
 */
export class SmtpNotifier extends Notifier {
    private client: SmtpClient;

    constructor(use_ssl: boolean, hostname: string, port?: number, username?: string, password?: string) {
        super();
        this.client = new SmtpClient();
        if (use_ssl) {
            this.client.connectTLS({ hostname, port, username, password });
        } else {
            this.client.connect({ hostname, port, username, password });
        }
    }

    add_event(): void {
        EMails.name;
        throw new Error("Method not implemented.");
    }

    static try_create(): Notifier | undefined {
        SmtpNotifier.logger.debug("trying to create SMTP Notifier");
        if (!env.ensure_defined("SMTP_HOSTNAME")) {
            SmtpNotifier.logger.debug("SMTP_HOSTNAME not set, skipping creation");
            return undefined;
        }

        const use_ssl = env.get_bool("SMTP_USETLS", false);
        const hostname = env.get_string("SMTP_HOSTNAME")!;
        const port = env.get_number("SMTP_PORT");
        const username = env.get_string("SMTP_USERNAME");
        const password = env.get_string("SMTP_PASSWORD");
        SmtpNotifier.logger.info(`creating SmtpNotifier for ${username}@${hostname}`);
        return new this(use_ssl, hostname, port, username, password);
    }
}

export const ALL_NOTIFIERS: typeof Notifier[] = [SmtpNotifier];
