import { DelimiterStream } from "../deps.ts";

const UA_VERSION = "2.6.2";
const UA_STRING = `Dolce Container Monitor v${UA_VERSION}`;

const CRLF = "\r\n";
const HEADER_DELIMITER = ": ";
const SPACE = " ";

const utf8_encoder = new TextEncoder(); // default 'utf-8', see: https://encoding.spec.whatwg.org/#interface-textdecoder
const ascii_decoder = new TextDecoder("ascii");
const encoded_crlf = utf8_encoder.encode(CRLF);

/**
 * creates a new stream from a reader. this is useful so the reader it is no longer in `disturbed` state
 * even if we already read from the stream. This is nerccessary because the `Response` constructor expects
 * a pristine stream that was never read from to track the `bodyUsed` state.
 */
function stream_from_reader(input: ReadableStreamDefaultReader<Uint8Array>): ReadableStream<Uint8Array> {
    return new ReadableStream({
        async start(controller) {
            let done: boolean;
            do {
                const read_result = await input.read();
                done = read_result.done;
                if (done) {
                    controller.close();
                    return;
                }
                controller.enqueue(read_result.value!);
            } while (!done);
        },
    });
}

/**
 * Represents a HTTP connection to a server over a (local) Unix Socket (AF_UNIX) or a local or remote TCP socket.
 * the `fetch` method represents a interface inspired by the `fetch` method in the WebPlatform
 */
export class HttpSocket {
    private static DEFAULT_HEADERS = new Headers({
        "User-Agent": UA_STRING,
        "Connection": "close", // keep the api much simpler by not allowing connection reuse
    });

    constructor(
        private socket_url: URL,
    ) {}

    private async get_connection(): Promise<Deno.UnixConn | Deno.TcpConn> {
        // const socket_url = new URL(`${this.transport}://${this.socket_path}`);
        if (this.socket_url.protocol === "unix:") {
            return await Deno.connect({
                path: this.socket_url.pathname,
                transport: "unix",
            });
        } else if (this.socket_url.protocol === "tcp:") {
            return await Deno.connect({
                hostname: this.socket_url.hostname,
                port: Number.parseInt(this.socket_url.port),
                transport: "tcp",
            });
        } else {
            throw new Error(
                `unexpected protocol in url ${this.socket_url.protocol}. thould be either "tcp:" or "unix:"`,
            );
        }
    }

    public async fetch(input: string | Request, init?: RequestInit | undefined) {
        const request = new Request(input, init);
        const request_url = new URL(request.url);
        // merge default and userprovided headers with user-provided values taking precendence.
        HttpSocket.DEFAULT_HEADERS.forEach((value, key) =>
            request.headers.get(key) ? null : request.headers.set(key, value)
        );
        if (request.headers.get("Connection") !== "close") {
            throw new Error("only 'Connection: close' connection header supported");
        }

        // encode the body and set headers if we have any information about the content type
        const request_body = new Uint8Array(await request.arrayBuffer());

        // build the request text;
        let request_header_string = `${request.method} ${request_url.pathname + request_url.search} HTTP/1.1${CRLF}`;
        request_header_string += `Host: ${request_url.host}${CRLF}`;
        request_header_string += `Content-Length: ${request_body.length.toString(10)}${CRLF}`;
        request.headers.forEach((value, key) => {
            request_header_string += `${key}: ${value}${CRLF}`;
        });

        const request_header = utf8_encoder.encode(request_header_string);
        const connection = await this.get_connection();
        await connection.write(request_header);
        await connection.write(encoded_crlf);
        await connection.write(request_body);
        await connection.write(encoded_crlf);

        const response = await this.read_response(connection);
        return response;
    }

    private async read_response(connection: Deno.UnixConn): Promise<Response> {
        const line_stream = connection.readable
            .pipeThrough(new DelimiterStream(encoded_crlf, { disposition: "suffix" }));
        let status = -1, status_text = "";
        const headers = new Headers();
        let response_part: "status" | "head" | "body" = "status";

        reader:
        for await (const response_line of line_stream.values({ preventCancel: true })) {
            // here it is safe to decode the data since we're either at the statusline or inside the headers
            // which can only contain ASCII an no other binary formats
            const decoded_response_line = ascii_decoder.decode(response_line);
            switch (response_part) {
                case "status": {
                    const [_, status_code_string, ...reason_phrase_parts] = decoded_response_line.split(SPACE);
                    status_text = reason_phrase_parts.join(SPACE).trim();
                    status = Number.parseInt(status_code_string, 10);
                    response_part = "head";
                    break;
                }
                case "head": {
                    if (decoded_response_line.trim().length === 0) {
                        response_part = "body";
                        break reader;
                    }
                    const [field_name, ...field_content] = decoded_response_line.split(HEADER_DELIMITER);
                    headers.set(field_name, field_content.join(HEADER_DELIMITER));
                    break;
                }
            }
        }

        let response_stream = stream_from_reader(line_stream.getReader());
        if (headers.get("Transfer-Encoding") === "chunked") {
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
class DechunkingTransferStream extends TransformStream<Uint8Array, Uint8Array> {
    constructor() {
        super(new DechunkingTransferStream.Unchunker());
    }

    static Unchunker = class implements Transformer<Uint8Array, Uint8Array> {
        private current_chunk_length?: number;
        private current_chunk_position = 0;
        private current_chunk_data?: Uint8Array;

        transform(chunk: Uint8Array, controller: TransformStreamDefaultController<Uint8Array>): void {
            // we're not currently decoing a chunk, start a new one;
            if (this.current_chunk_length === undefined) {
                const data_length_string = String.fromCharCode(...chunk).trim();
                if (data_length_string.length == 0) {
                    return;
                }
                this.current_chunk_length = Number.parseInt(data_length_string, 16);
                this.current_chunk_data = new Uint8Array(this.current_chunk_length);
                if (this.current_chunk_length === 0) {
                    // a zero-length chunk indicates the end of the stream
                    controller.terminate();
                }

                return;
            }

            // read the chunk. the final CRLF is not part of the chunk data
            const data_view = chunk.subarray(0, this.current_chunk_length - this.current_chunk_position);
            this.current_chunk_data!.set(data_view, this.current_chunk_position);
            this.current_chunk_position += chunk.length;
            if (this.current_chunk_position >= this.current_chunk_length) {
                this.current_chunk_length = undefined;
                this.current_chunk_position = 0;
                controller.enqueue(this.current_chunk_data!);
            }
        }
    };
}
