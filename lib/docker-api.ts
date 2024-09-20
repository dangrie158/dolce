import { TextLineStream } from "../deps.ts";
import { DeadlinedReader } from "./async.ts";
import { HttpSocket } from "./universal-http.ts";

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

type DockerInfoResponse = {
    ID: string;
    Containers: number;
    ContainersRunning: number;
    ContainersPaused: number;
    ContainersStopped: number;
    Images: number;
    Driver: string;
    DriverStatus: [string, string][];
    MemoryLimit: boolean;
    SwapLimit: boolean;
    PidsLimit: boolean;
    Debug: boolean;
    NFd: number;
    SystemTime: string;
    LoggingDriver: string;
    CgroupDriver: string;
    CgroupVersion: string;
    KernelVersion: string;
    OperatingSystem: string;
    OSVersion: string;
    OSType: string;
    Architecture: string;
    NCPU: number;
    MemTotal: number;
    DockerRootDir: string;
    Name: string;
    Labels: string[];
    ExperimentalBuild: boolean;
    ServerVersion: string;
    //...
};

export const CONTAINER_ACTIONS = [
    "attach",
    "commit",
    "copy",
    "create",
    "destroy",
    "die",
    "exec_create",
    "exec_start",
    "export ",
    "kill",
    "oom",
    "pause",
    "rename",
    "resize",
    "restart",
    "start",
    "stop",
    "top",
    "unpause",
    "update",
    "health_status",
] as const;
export type ContainerAction = (typeof CONTAINER_ACTIONS)[number];
type ImageAction = "delete" | "import" | "load" | "pull" | "push" | "save" | "tag" | "untag" | "prune";
type VolumeAction = "create" | "mount" | "unmount" | "destroy" | "prune";
type NetworkAction = "create" | "connect" | "disconnect" | "destroy" | "update" | "remove" | "prune";
type GenericDockerApiEvent<Type, Actions> = {
    status: Actions;
    id: string;
    from: string;
    Type: Type;
    Action: Actions;
    Actor: {
        ID: string;
        Attributes: {
            name: string;
            image: string;
        } & Record<string, string | null>;
    };
    scope: "local" | "swarm";
    time: number;
    timeNano: number;
};

export type DockerApiContainerEvent = GenericDockerApiEvent<"container", ContainerAction>;
export type DockerApiImageEvent = GenericDockerApiEvent<"image", ImageAction>;
export type DockerApiVolumeEvent = GenericDockerApiEvent<"volume", VolumeAction>;
export type DockerApiNetworkEvent = GenericDockerApiEvent<"network", NetworkAction>;
export type DockerApiEvent =
    | DockerApiContainerEvent
    | DockerApiImageEvent
    | DockerApiVolumeEvent
    | DockerApiNetworkEvent;

type DockerEventAction = DockerApiEvent["Action"];
type DockerEventType = DockerApiEvent["Type"];
export type DockerApiEventFilters = {
    event?: DockerEventAction[];
    type?: DockerEventType[];
    container?: string[];
    image?: string[];
    label?: string[];
    volume?: string[];
    network?: string[];
};

export class DockerApi {
    // we use the oldest version of the API that supports all the features we want
    // to be compatible with most versions.
    public static DEFAULT_VERSION = "v1.27";
    public static DEFAULT_SOCKET_PATH = new URL("unix:///var/run/docker.sock");
    public static DEFAULT_HEADERS = {
        Accept: "application/json",
        "Accept-Encoding": "identity",
    };

    private socket_client: HttpSocket;

    constructor(socket_path: URL = DockerApi.DEFAULT_SOCKET_PATH, private api_version = DockerApi.DEFAULT_VERSION) {
        this.socket_client = new HttpSocket(socket_path);
    }

    private get(endpoint: `/${string}`): Promise<Response> {
        return this.socket_client.fetch(`http://localhost/${this.api_version}${endpoint}`, {
            headers: DockerApi.DEFAULT_HEADERS,
        });
    }

    async get_version(): Promise<DockerVersionReponse> {
        const response = await this.get("/version");
        return response.json();
    }

    async get_info(): Promise<DockerInfoResponse> {
        const response = await this.get("/info");
        return response.json();
    }

    async get_container(id: string): Promise<DockerContainerResponse> {
        const response = await this.get(`/containers/${id}/json`);
        return response.json();
    }

    async subscribe_events(
        options: { since?: Date; until?: Date; filters?: DockerApiEventFilters } = {},
    ): Promise<AsyncGenerator<DockerApiEvent>> {
        const url = new URL(`http://localhost/${this.api_version}/events`);
        if (options.since !== undefined) {
            const date_param = options.since.getTime() / 1_000;
            url.searchParams.append("since", date_param.toFixed());
        }
        if (options.until !== undefined) {
            const date_param = options.until.getTime() / 1_000;
            url.searchParams.append("until", date_param.toFixed());
        }
        if (options.filters !== undefined) {
            const date_param = JSON.stringify(options.filters);
            url.searchParams.append("filters", date_param);
        }

        const http_stream = await this.socket_client.fetch(url.toString(), { headers: DockerApi.DEFAULT_HEADERS });
        let line_reader = http_stream
            .body!.pipeThrough(new TextDecoderStream())
            .pipeThrough(new TextLineStream())
            .getReader();

        if (options.until !== undefined && options.until.getTime() < Date.now()) {
            // there is a known bug in the docker api that it doesn't end the stream
            // when the until parameter is reached: https://github.com/moby/moby/issues/48536
            // we add a deadline to the reader to prevent it from hanging forever
            const deadline = options.until.getTime() - Date.now() + 1_000;
            line_reader = DeadlinedReader(line_reader, deadline);
        }

        return (async function* event_stream() {
            do {
                const { done, value } = await line_reader.read();
                if (done) return;
                yield JSON.parse(value);
            } while (true);
        })();
    }
}
