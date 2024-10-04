import { TextLineStream } from "@std/streams";
import { writeAll } from "@std/io/write-all";

const encoder = new TextEncoder();

type Command = {
    code: number;
    args: string;
};

const ContentTransferEncodings = ["7bit", "8bit", "base64", "binary", "quoted-printable"] as const;
type ContentTransferEncoding = (typeof ContentTransferEncodings)[number];

enum CommandCode {
    READY = 220,
    AUTHO_SUCCESS = 235,
    OK = 250,
    SERVER_CHALLENGE = 334,
    BEGIN_DATA = 354,
    FAIL = 554,
}
type ConnectConfig = {
    hostname: string;
    port?: number;
};

type ConnectConfigWithAuthentication = ConnectConfig & {
    username: string;
    password: string;
};

type Message = {
    to: string;
    from: string;
    subject: string;
    content: string;
    html?: string;
};

type SmtpClientOptions = { content_encoding: ContentTransferEncoding };

export class SmtpClient {
    private connection: Deno.Conn | null = null;
    private reader: ReadableStreamDefaultReader<string> | null = null;
    private content_encoding: ContentTransferEncoding;

    constructor(options: SmtpClientOptions = { content_encoding: "quoted-printable" }) {
        this.content_encoding = options.content_encoding;
    }

    async connect_plain(config: ConnectConfig) {
        const connection = await Deno.connect({
            hostname: config.hostname,
            port: config.port || 25,
        });
        await this.connect(connection, config);
    }

    async connect_tls(config: ConnectConfigWithAuthentication) {
        const connection = await Deno.connectTls({
            hostname: config.hostname,
            port: config.port || 465,
        });
        await this.connect(connection, config);
    }

    private async connect(connection: Deno.Conn, config: ConnectConfig) {
        this.connection = connection;
        this.reader = this.connection.readable
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(new TextLineStream())
            .getReader();

        this.assert_code(await this.read_command(), CommandCode.READY);

        await this.write_command(`EHLO ${config.hostname}\r\n`);
        while (true) {
            const command = await this.read_command();
            if (!command || !command.args.startsWith("-")) break;
        }
        if (this.use_authentication(config)) {
            await this.write_command(`AUTH LOGIN\r\n`);
            this.assert_code(await this.read_command(), CommandCode.SERVER_CHALLENGE);

            await this.write_command(`${btoa(config.username)}\r\n`);
            this.assert_code(await this.read_command(), CommandCode.SERVER_CHALLENGE);

            await this.write_command(`${btoa(config.password)}\r\n`);
            this.assert_code(await this.read_command(), CommandCode.AUTHO_SUCCESS);
        }
    }

    close() {
        if (!this.connection) {
            return;
        }
        this.connection.close();
        this.reader = null;
        this.connection = null;
    }

    async send(config: Message) {
        const [from, from_data] = this.parse_address(config.from);
        const [to, to_data] = this.parse_address(config.to);

        await this.write_command(`MAIL FROM: ${from}\r\n`);
        this.assert_code(await this.read_command(), CommandCode.OK);
        await this.write_command(`RCPT TO: ${to}\r\n`);
        this.assert_code(await this.read_command(), CommandCode.OK);
        await this.write_command(`DATA\r\n`);
        this.assert_code(await this.read_command(), CommandCode.BEGIN_DATA);

        await this.write_command(`Subject: ${config.subject}\r\n`);
        await this.write_command(`From: ${from_data}\r\n`);
        await this.write_command(`To: ${to_data}\r\n`);
        await this.write_command(`Date: ${new Date().toString()}\r\n`);

        if (config.html) {
            await this.write_command(`Content-Type: multipart/alternative; boundary=AlternativeBoundary\r\n\r\n`);
            await this.write_command(`--AlternativeBoundary\r\n`);
            await this.write_command(`Content-Type: text/plain; charset="utf-8\r\n\r\n`);
            await this.write_command(`${config.content}\r\n\r\n`);
            await this.write_command(`--AlternativeBoundary\r\n`);
            await this.write_command(`Content-Type: text/html; charset="utf-8\r\n\r\n`);
            await this.write_command(`${config.html}\r\n.\r\n\r\n`);
        } else {
            await this.write_command(`MIME-Version: 1.0\r\n`);
            await this.write_command(`Content-Type: text/html;charset=utf-8\r\n`);
            await this.write_command(`Content-Transfer-Encoding: ${this.content_encoding}\r\n\r\n`);
            await this.write_command(`${config.content}\r\n.\r\n\r\n`);
        }

        this.assert_code(await this.read_command(), CommandCode.OK);
    }
    private assert_code(cmd: Command | null, code: number, msg?: string) {
        if (cmd === null) {
            throw new Error(`invalid command`);
        }
        if (cmd.code !== code) {
            throw new Error(msg || `${cmd.code}: ${cmd.args}`);
        }
    }

    private async read_command(): Promise<Command | null> {
        if (this.reader === null) {
            throw new Error("you need to connect first");
        }
        const { done, value } = await this.reader.read();
        if (done) return null;
        const command_code = parseInt(value.slice(0, 3).trim());
        const command_arguments = value.slice(3).trim();
        return {
            code: command_code,
            args: command_arguments,
        };
    }

    private async write_command(cmd: `${string}\r\n`) {
        if (this.connection === null) {
            throw new Error("you need to connect first");
        }
        const data = encoder.encode(cmd);
        await writeAll(this.connection, data);
    }

    private use_authentication(
        config: ConnectConfig | ConnectConfigWithAuthentication,
    ): config is ConnectConfigWithAuthentication {
        return (config as ConnectConfigWithAuthentication).username !== undefined;
    }

    private parse_address(email: string): [string, string] {
        const m = email.toString().match(/(.*)\s<(.*)>/);
        return m?.length === 3 ? [`<${m[2]}>`, email] : [`<${email}>`, `<${email}>`];
    }
}
