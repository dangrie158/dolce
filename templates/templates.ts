import { Eta, path } from "../deps.ts";
console.log(new URL('.', import.meta.url).pathname);
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const eta = new Eta({ views: __dirname });

const __filename = path.fromFileUrl(import.meta.url);
console.log(eta.render("./emails/event.eta", { name: "Ben" }));
export class EMails {

}
