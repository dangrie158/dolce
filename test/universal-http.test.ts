import { HttpSocket } from "../lib/universal-http.ts";
import {
    assert,
    assertInstanceOf,
    assertNotEquals,
    assertObjectMatch,
    assertRejects,
    assertStrictEquals,
} from "https://deno.land/std@0.203.0/assert/mod.ts";

["tcp", "unix"].forEach((protocol) => {
    Deno.test(`fetch API with ${protocol} protocol`, async (test) => {
        const worker = new Worker(new URL("./dummy-server.ts", import.meta.url).href, { type: "module" });
        worker.postMessage(protocol);
        const server_socket = await new Promise<URL>((resolve) => {
            worker.onmessage = (socket_path_message: MessageEvent<URL>) => {
                resolve(new URL(socket_path_message.data));
            };
        });

        const socket_client = new HttpSocket(server_socket);

        await test.step("`fetch` does not support `Connection: keep-alive`", () => {
            const response = socket_client.fetch("http://localhost/empty/", {
                headers: { "Connection": "keep-alive" },
            });
            assertRejects(() => response);
        });

        await test.step("responds with a `Reponse` object", async () => {
            const response = await socket_client.fetch("http://localhost/empty/");
            assertInstanceOf(response, Response);
        });

        await test.step("response contains parsed status", async () => {
            const response = await socket_client.fetch("http://localhost/empty/");
            assertStrictEquals(response.status, 200);
            assertStrictEquals(response.statusText, "OK");
        });

        await test.step("response contains a body", async () => {
            const response = await socket_client.fetch("http://localhost/empty/");
            assertNotEquals(await response.text(), null);
        });

        await test.step("response can be parsed as json", async () => {
            const response = await socket_client.fetch("http://localhost/empty/");
            assertObjectMatch(await response.json(), {});
        });

        await test.step("requests can have a `JSON` body", async () => {
            const response = await socket_client.fetch("http://localhost/echojson/", {
                method: "POST",
                body: JSON.stringify({ key: "value" }),
                headers: { "Content-Type": "application/json" },
            });
            assertObjectMatch(await response.json(), { key: "value" });
        });

        await test.step("requests can have a `FormData` body", async () => {
            const test_data = new FormData();
            test_data.set("key", "value");
            const response = await socket_client.fetch("http://localhost/echoformdata/", {
                method: "POST",
                body: test_data,
            });
            const response_data = await response.formData();
            assert(response_data.has("key"));
            assertStrictEquals(response_data.get("key"), "value");
        });

        await test.step("`fetch` can unchunk a `Transfer-Encoding: chunked` response", async () => {
            const response = await socket_client.fetch("http://localhost/echochunked/", {
                method: "POST",
                body: "test stream",
            });
            assert(response.headers.has("Transfer-Encoding"));
            assertStrictEquals(response.headers.get("Transfer-Encoding"), "chunked");
            const response_data = await response.text();
            assertStrictEquals(response_data, "test stream");
        });

        await test.step("`fetch` can stream a response body", async () => {
            const response = await socket_client.fetch("http://localhost/getstream/", { method: "GET" });
            assert(response.headers.has("Transfer-Encoding"));
            assertStrictEquals(response.headers.get("Transfer-Encoding"), "chunked");
            const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader();
            const first_event = await reader!.read();
            assert(first_event.done === false);
            assertStrictEquals(first_event.value, "event");

            const third_event = await reader!.read();
            assert(third_event.done === true);
        });

        worker.postMessage("terminate");
        worker.terminate();
    });
});
