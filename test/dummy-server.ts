/// <reference no-default-lib="true"/>
/// <reference lib="deno.window" />
/// <reference lib="deno.unstable" />
/// <reference lib="webworker" />

self.onmessage = async (message: MessageEvent<string>) => {
    const protocol = message.data;

    const request_handler = async (request: Request) => {
        switch (new URL(request.url).pathname) {
            case "/empty/":
                return new Response("{}", { status: 200 });
            case "/echojson/":
                return new Response(JSON.stringify(await request.json()), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            case "/echoformdata/":
                return new Response(await request.formData(), { status: 200 });
            case "/echochunked/":
                return new Response(request.body, { status: 200, headers: { "Transfer-Encoding": "chunked" } });
            case "/getstream/": {
                const stream = new ReadableStream({
                    type: "bytes",
                    start(controller: ReadableByteStreamController) {
                        controller.enqueue(new TextEncoder().encode("event"));
                        controller.close();
                    },
                });
                return new Response(stream, { status: 200 });
            }
            default:
                return new Response(undefined, { status: 404 });
        }
    };

    if (protocol === "tcp") {
        Deno.serve(
            {
                hostname: "127.0.0.1",
                onListen: ({ hostname, port }) => self.postMessage(new URL(`tcp://${hostname}:${port}`).toString()),
            },
            request_handler,
        );
    } else if (protocol === "unix") {
        const socket_dir = await Deno.makeTempDir();
        const socket_path = `${socket_dir}/dolce-test.sock`;
        const abort_controller = new AbortController();
        abort_controller.signal.addEventListener("abort", () => {
            Deno.removeSync(socket_path);
        });

        Deno.serve(
            {
                path: socket_path,
                signal: abort_controller.signal,
                onListen: () => self.postMessage(new URL(`unix://${socket_path}`).toString()),
            },
            request_handler,
        );
        self.postMessage(new URL(`unix://${socket_path}`).toString());
    } else {
        throw new Error(`unknown protocol: "${protocol}"`);
    }
};
