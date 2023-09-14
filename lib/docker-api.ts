import { UnixHttpSocket } from "./uds-http.ts";

export class DockerApi {
    // we use the oldest version of the API that supports all the features we want
    // to be compatible with most versions.
    private static DEFAULT_VERSION = "v1.22";
    private static DEFAULT_HEADERS = {
        "Accept": "application/json",
        "Accept-Encoding": "identity"
    };

    private socket_client: UnixHttpSocket;

    constructor(
        private api_version = DockerApi.DEFAULT_VERSION
    ) {
        this.socket_client = new UnixHttpSocket("/var/run/docker.sock");
    }

    async get_version() {
        return await this.socket_client.fetch(`/${this.api_version}/version`, { headers: DockerApi.DEFAULT_HEADERS, method: "GET" });
    }

    async get_images() {
        return await this.socket_client.fetch(`/${this.api_version}/images/json`, { headers: DockerApi.DEFAULT_HEADERS, method: "GET" });
    }

}
