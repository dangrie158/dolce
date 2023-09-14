import { DockerApi } from "./lib/docker-api.ts";


const response = await new DockerApi().get_images();
console.log(response);
// console.log(await response.text());
console.log(await response.json());
console.log("done");
