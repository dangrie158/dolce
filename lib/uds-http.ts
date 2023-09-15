
import { stdio, stdstreams } from "../deps.ts";

const UA_VERSION = "0.1.0";
const UA_STRING = `Dolce Container Monitor v${UA_VERSION}`;

const CRLF = "\r\n";
const HEADER_DELIMITER = ": ";
const SPACE = " ";

const utf8_encoder = new TextEncoder(); // default 'utf-8', see: https://encoding.spec.whatwg.org/#interface-textdecoder
const ascii_decoder = new TextDecoder("ascii");
const encoded_crlf = utf8_encoder.encode(CRLF);

/**
 * resets a stream reader so it is no longer in `disturbed` state even if we already read from the stream.
 * This is nerccessary because the `Response` constructor expects a pristine stream that was never read
 * from to track the `bodyUsed` state.
 */
function reset_stream(input: ReadableStreamDefaultReader<Uint8Array>): ReadableStream<Uint8Array> {
    return stdstreams.readableStreamFromReader(stdstreams.readerFromStreamReader(input));
}

function encode_search_params(data: URLSearchParams): Uint8Array {
    const encoded_form_data: string[] = [];
    data.forEach((value, key) => {
        encoded_form_data.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    });
    return utf8_encoder.encode(encoded_form_data.join("="));
}

async function encode_form_data(data: FormData): Promise<[string, Uint8Array]> {
    const boundary = `-----Boundary_${crypto.randomUUID()}`;
    const encoded_boundary = utf8_encoder.encode(boundary);
    const body_buffer = new stdio.Buffer();
    await data.forEach(async (value, key) => {
        if (typeof value === "string") {
            let part = `${boundary}${CRLF}`;
            part += `Content-Disposition: form-data; name="${key}"${CRLF}`;
            part += `${value}${CRLF}`;
            const encoded_part = utf8_encoder.encode(part);
            body_buffer.grow(encoded_part.length);
            await body_buffer.write(encoded_part);
        } else {
            let part_header = `${boundary}${CRLF}`;
            part_header += `Content-Disposition: form-data; name="${key}"${CRLF}`;
            part_header += `Content-Type: "${value.type}"${CRLF}`;
            const encoded_part_header = utf8_encoder.encode(part_header);
            body_buffer.grow(encoded_part_header.length + value.size + encoded_crlf.length);
            await body_buffer.write(encoded_part_header);
            await body_buffer.write(new Uint8Array(await value.arrayBuffer()));
            await body_buffer.write(encoded_crlf);
        }
        body_buffer.grow(encoded_boundary.length + encoded_crlf.length);
        await body_buffer.write(encoded_boundary);
        await body_buffer.write(encoded_crlf);
    });
    return [boundary, await stdstreams.readAll(body_buffer)];
}

async function encode_body(body: BodyInit): Promise<[string, Uint8Array]> {
    if (typeof body === "string") {
        return ["", utf8_encoder.encode(body)];
    } else if (body instanceof ReadableStream) {
        return ["", await stdstreams.readAll(stdstreams.readerFromStreamReader(body.getReader()))];
    } else if (body instanceof FormData) {
        const [boundary, encoded_body] = await encode_form_data(body);
        return [`multipart/form-data; boundary=${boundary}`, encoded_body];
    } else if (body instanceof URLSearchParams) {
        return ["multipart/x-www-form-urlencoded", encode_search_params(body)];
    } else if (body instanceof Blob) {
        return [body.type, new Uint8Array(await body.arrayBuffer())];
    } else if (body instanceof ArrayBuffer) {
        return ["", new Uint8Array(body)];
    }
    throw new Error(`Don't know how to encode body of type ${body.constructor.name}`);
}

/**
 * Represents a HTTP connection to a server over a (local) Unix Socket (AF_UNIX).
 * the `fetch` method represents a interface inspired by the `fetch` method in the WebPlatform
 */
export class UnixHttpSocket {
    private static DEFAULT_HEADERS = new Headers({
        "Host": "localhost", // localhost ist the default host for UDS connections as it doesn't matter
        "User-Agent": UA_STRING,
        "Connection": "close" // keep the api much simpler by not allowing connection reuse
    });

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
        const request_headers = new Headers();
        UnixHttpSocket.DEFAULT_HEADERS.forEach((value, key) => request_headers.set(key, value));
        new Headers(options.headers)?.forEach((value, key) => request_headers.set(key, value));
        if (options.body) {
            request_headers.set("Content-Length", options.body.toString());
        }

        // encode the body and set headers if we have any information about the content type
        let request_body = new Uint8Array(0), content_type: string;
        if (options.body) {
            [content_type, request_body] = await encode_body(options.body);
            request_headers.set("Content-Length", request_body.length.toString(10));
            // only set the content type if it is not already set by the user
            if (content_type !== "" && !request_headers.has("Content-Type")) {
                request_headers.set("Content-Type", content_type);
            }
        }

        // build the request text
        let request_header_string = `${options.method} ${path} HTTP/1.1${CRLF}`;
        request_headers.forEach((value, key) => {
            request_header_string += `${key}: ${value}${CRLF}`;
        });

        const request_header = utf8_encoder.encode(request_header_string);
        const request_size = request_header.length + encoded_crlf.length + request_body.length + encoded_crlf.length;
        const request_data = new stdio.Buffer();
        request_data.grow(request_size);
        await request_data.write(request_header);
        await request_data.write(encoded_crlf);
        await request_data.write(request_body);
        await request_data.write(encoded_crlf);

        const connection = await this.get_connection();
        await connection.write(request_data.bytes());

        const response = await this.read_response(connection);
        return response;
    }

    private async read_response(connection: Deno.UnixConn): Promise<Response> {
        const http_stream = stdstreams.readableStreamFromReader(new stdio.BufReader(connection));
        const line_stream = http_stream.pipeThrough(new stdstreams.DelimiterStream(encoded_crlf, { disposition: "suffix" }));

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

        let response_stream = reset_stream(line_stream.getReader());
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
class DechunkingTransferStream implements TransformStream<Uint8Array, Uint8Array> {
    public readonly readable: ReadableStream<Uint8Array>;
    public readonly writable: WritableStream<Uint8Array>;

    constructor() {
        const unchunker = new DechunkingTransferStream.Unchunker();

        this.readable = new ReadableStream({
            start(controller) {
                unchunker.on_chunk = chunk => controller.enqueue(chunk);
                unchunker.on_close = () => controller.close();
            }
        });

        this.writable = new WritableStream({
            write(uint8Array) {
                unchunker.addBinaryData(uint8Array);
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
                const data_length_string = String.fromCharCode(...data).trim();
                if (data_length_string.length == 0) {
                    return;
                }
                this.current_chunk_length = Number.parseInt(data_length_string, 16);
                this.current_chunk_data = new Uint8Array(this.current_chunk_length);
                if (this.current_chunk_length === 0) {
                    // a zero-length chunk indicates the end of the stream
                    this.on_close?.();
                }

                return;
            }

            // read the chunk. the final CRLF is not part of the chunk data
            const data_view = data.subarray(0, this.current_chunk_length - this.current_chunk_position);
            this.current_chunk_data!.set(data_view, this.current_chunk_position);
            this.current_chunk_position += data.length;
            if (this.current_chunk_position >= this.current_chunk_length) {
                this.current_chunk_length = undefined;
                this.current_chunk_position = 0;
                this.on_chunk?.(this.current_chunk_data!);
            }
        }
    };
}
