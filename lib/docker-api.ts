import { stdstreams, stdio } from "../deps.ts";
import { UnixHttpSocket } from "./uds-http.ts";

type DockerVersionReponse = {
    Version: string;
    Os: string;
    KernelVersion: string;
    GoVersion: string;
    GitCommit: string;
    Arch: string;
    ApiVersion: string;
    BuildTime: string;
    Experimental: boolean;
};

type DockerContainerResponse = {
    Id: string;
    Names: string[];
    Image: string;
    ImageID: string;
    Command: string;
    Created: number;
    Status: string;
    Ports: number[];
    Labels: Record<string, string>;
    SizeRw: number;
    SizeRootFs: number;
};

type ContainerAction = "attach" | "commit" | "copy" | "create" | "destroy" | "die" | "exec_create" | "exec_start" | "export " | "kill" | "oom" | "pause" | "rename" | "resize" | "restart" | "start" | "stop" | "top" | "unpause" | "update";
type ImageAction = "delete" | "import" | "load" | "pull" | "push" | "save" | "tag" | "untag" | "prune";
type VolumeAction = "create" | "mount" | "unmount" | "destroy" | "prune";
type NetworkAction = "create" | "connect" | "disconnect" | "destroy" | "update" | "remove" | "prune";
type GenericDockerEvent<Type, Actions> = {
    status: Actions;
    id: string,
    from: string;
    Type: Type,
    Action: Actions,
    Actor: {
        ID: string,
        Attributes: Record<string, string | null>,
    };
    scope: "local" | "swarm";
    time: number,
    timeNano: number;
};

type DockerContainerEvent = GenericDockerEvent<"container", ContainerAction>;
type DockerImageEvent = GenericDockerEvent<"image", ImageAction>;
type DockerVolumeEvent = GenericDockerEvent<"volume", VolumeAction>;
type DockerNetworkEvent = GenericDockerEvent<"network", NetworkAction>;
type DockerEvent = DockerContainerEvent | DockerImageEvent | DockerVolumeEvent | DockerNetworkEvent;


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

    private get(endpoint: `/${string}`): Promise<Response> {
        return this.socket_client.fetch(`http://localhost/${this.api_version}${endpoint}`, { headers: DockerApi.DEFAULT_HEADERS });
    }

    async get_version(): Promise<DockerVersionReponse> {
        const response = await this.get("/version");
        return response.json();
    }

    async get_containers(): Promise<DockerContainerResponse> {
        const response = await this.get("/containers");
        return response.json();
    }

    async subscribe_events(): Promise<AsyncGenerator<DockerEvent>> {
        const http_stream = await this.socket_client.fetch(`http://localhost/${this.api_version}/events`, { headers: DockerApi.DEFAULT_HEADERS });
        const http_stream_reader = http_stream.body!.getReader();
        const reader = new stdio.BufReader(stdstreams.readerFromStreamReader(http_stream_reader));
        return async function* event_stream() {
            do {
                const nextLine = await reader.readString("\n");
                if (nextLine !== null) {
                    yield JSON.parse(nextLine);
                }
            } while (true);
        }();
    }
}
