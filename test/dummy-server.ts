/// <reference no-default-lib="true"/>
/// <reference lib="deno.window" />
/// <reference lib="deno.unstable" />
/// <reference lib="webworker" />

const socket_dir = await Deno.makeTempDir();
const socket_path = `${socket_dir}/dolce-test.sock`;
const server = Deno.listen({ path: socket_path, transport: "unix" });

self.onbeforeunload = () => {
    // cleanup when done
    server.close();
    Deno.removeSync(socket_path);
};

// tell the "client" that we're ready to accept connections
self.postMessage(socket_path);

for await (const conn of server) {
    (async () => {
        const httpConn = Deno.serveHttp(conn);
        for await (const requestEvent of httpConn) {
            switch (new URL(requestEvent.request.url).pathname) {
                case "/empty/":
                    return requestEvent.respondWith(new Response("{}", { status: 200 }));
                case "/echojson/":
                    return requestEvent.respondWith(
                        new Response(JSON.stringify(await requestEvent.request.json()), {
                            status: 200,
                            headers: { "Content-Type": "application/json" },
                        }),
                    );
                case "/echoformdata/":
                    return requestEvent.respondWith(
                        new Response(await requestEvent.request.formData(), { status: 200 }),
                    );
                case "/echochunked/":
                    return requestEvent.respondWith(new Response(await requestEvent.request.body, { status: 200 }));
                case "/getstream/": {
                    const stream = new ReadableStream({
                        type: "bytes",
                        start(controller: ReadableByteStreamController) {
                            controller.enqueue(new TextEncoder().encode("event"));
                            controller.close();
                        },
                    });
                    return requestEvent.respondWith(new Response(stream, { status: 200 }));
                }
                default:
                    return requestEvent.respondWith(new Response(undefined, { status: 404 }));
            }
        }
    })();
}
