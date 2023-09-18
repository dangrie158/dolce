import { DockerApi } from "./lib/docker-api.ts";


const api = await new DockerApi();

const response = await api.get_version();
console.log(await response);

const event_stream = await api.subscribe_events();

for await (const event of event_stream) {
    console.log(event);
}

console.log("done");
