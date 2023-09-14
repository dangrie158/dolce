
import { stdio, stdstreams } from "../deps.ts";

const UA_VERSION = "0.0.1";
const UA_STRING = `Dolce Container Monitor v${UA_VERSION}`;

const CRLF = "\r\n";
const HEADER_DELIMITER = ": ";
const SPACE = " ";

type HTTPHeaders = Record<string, string>;

const utf8_encoder = new TextEncoder(); // default 'utf-8', see: https://encoding.spec.whatwg.org/#interface-textdecoder
const ascii_decoder = new TextDecoder("ascii");

/**
 * resets a stream reader so it is no longer in `disturbed` state even if we already read from the stream.
 * This is nerccessary because the `Response` constructor expects a pristine stream that was never read
 * from to track the `bodyUsed` state.
 */
function reset_stream(input: ReadableStreamDefaultReader<Uint8Array>): ReadableStream<Uint8Array> {
    return stdstreams.readableStreamFromReader(stdstreams.readerFromStreamReader(input));
}

/**
 * Represents a HTTP connection to a server over a (local) Unix Socket (AF_UNIX).
 * the `fetch` method represents a interface inspired by the `fetch` method in the WebPlatform
 */
export class UnixHttpSocket {
    private static DEFAULT_HEADERS = {
        "Host": "localhost", // localhost ist the default host for UDS connections as it doesn't matter
        "User-Agent": UA_STRING,
        "Connection": "close" // keep the api much simpler by not allowing connection reuse
    };

    constructor(
        private socket_path: string
    ) { }

    private async get_connection(): Promise<Deno.UnixConn> {
        return await Deno.connect({
            path: this.socket_path,
            transport: "unix"
        });
    }

    public async fetch(path: `/${string}`, options: RequestInit) {
        // merge default and userprovided headers with user-provided values taking precendence.
        // note that we have no guarantee of header field order, however in practice it does not matter
        // see: https://www.rfc-editor.org/rfc/rfc9110.html
        const request_headers = {
            ...UnixHttpSocket.DEFAULT_HEADERS,
            ...options.headers
        };

        // build the request text
        let request_body = `${options.method} ${path} HTTP/1.1${CRLF}`;
        Object.entries(request_headers).map(([field_name, field_content]) => {
            request_body += `${field_name}: ${field_content}${CRLF}`;
        });
        request_body += CRLF;

        const connection = await this.get_connection();
        await connection.write(utf8_encoder.encode(request_body));
        const response = await this.read_response(connection);
        return response;
    }

    private async read_response(connection: Deno.UnixConn): Promise<Response> {
        const http_stream = stdstreams.readableStreamFromReader(new stdio.BufReader(connection));
        const line_stream = http_stream.pipeThrough(new stdstreams.DelimiterStream(utf8_encoder.encode(CRLF)));

        let status = -1, status_text = "";
        const headers: HTTPHeaders = {};
        let response_part: "status" | "head" | "body" = "status";

        reader:
        for await (const response_line of line_stream.values({ preventCancel: true })) {
            // here it is safe to decode the data since we're either at the statusline or inside the headers
            // which can only contain ASCII an no other binary formats
            const decoded_response_line = ascii_decoder.decode(response_line);
            switch (response_part) {
                case "status": {
                    const [_, status_code_string, ...reason_phrase_parts] = decoded_response_line.split(SPACE);
                    status_text = reason_phrase_parts.join(SPACE);
                    status = Number.parseInt(status_code_string, 10);
                    response_part = "head";
                    break;
                }
                case "head": {
                    if (response_line.length === 0) {
                        response_part = "body";
                        break reader;
                    }
                    const [field_name, ...field_content] = decoded_response_line.split(HEADER_DELIMITER);
                    headers[field_name] = field_content.join(HEADER_DELIMITER);
                    break;
                }
            }
        }

        let response_stream = reset_stream(line_stream.getReader());
        if (headers["Transfer-Encoding"] === "chunked") {
            response_stream = response_stream.pipeThrough(new DechunkingTransferStream());
        }

        return new Response(response_stream, { status, statusText: status_text, headers });
    }
}

/**
 * decodes a `chunked` transfer-encoded stream that is split into CRLF-chunks.
 * This class assumes that the data comes in packets that are separated by CRLF tokens
 * by using a stdstreams.DelimiterStream transformation.
 */
class DechunkingTransferStream implements TransformStream<Uint8Array, Uint8Array> {
    public readonly readable: ReadableStream<Uint8Array>;
    public readonly writable: WritableStream<Uint8Array>;

    constructor() {
        const unpacker = new DechunkingTransferStream.Unchunker();

        this.readable = new ReadableStream({
            start(controller) {
                unpacker.on_chunk = chunk => controller.enqueue(chunk);
                unpacker.on_close = () => controller.close();
            }
        });

        this.writable = new WritableStream({
            write(uint8Array) {
                unpacker.addBinaryData(uint8Array);
            }
        });
    }

    static Unchunker = class {
        public on_chunk?: (chunk: Uint8Array) => void;
        public on_close?: () => void;

        private current_chunk_length?: number;
        private current_chunk_position = 0;
        private current_chunk_data?: Uint8Array;

        addBinaryData(data: Uint8Array) {
            // we're not currently decoing a chunk, start a new one
            if (this.current_chunk_length === undefined) {
                // find first index of a linefeed
                this.current_chunk_length = Number.parseInt(String.fromCharCode(...data), 16);
                this.current_chunk_data = new Uint8Array(this.current_chunk_length);

                if (this.current_chunk_length === 0) {
                    // a zero-length chunk indicates the end of the stream
                    this.on_close?.();
                }

                return;
            }

            // read the chunk
            this.current_chunk_data!.set(data, this.current_chunk_position);
            this.current_chunk_position += data.length;

            if (this.current_chunk_position == this.current_chunk_length) {
                this.on_chunk?.(this.current_chunk_data!);
                this.current_chunk_length = undefined;
                this.current_chunk_position = 0;
            }
        }
    };
}
