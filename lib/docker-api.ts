import { streams, io } from "../deps.ts";
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
    NCPU: number,
    MemTotal: number;
    DockerRootDir: string;
    Name: string;
    Labels: string[];
    ExperimentalBuild: boolean;
    ServerVersion: string;
    //...
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

export type DockerContainerEvent = GenericDockerEvent<"container", ContainerAction>;
export type DockerImageEvent = GenericDockerEvent<"image", ImageAction>;
export type DockerVolumeEvent = GenericDockerEvent<"volume", VolumeAction>;
export type DockerNetworkEvent = GenericDockerEvent<"network", NetworkAction>;
export type DockerEvent = DockerContainerEvent | DockerImageEvent | DockerVolumeEvent | DockerNetworkEvent;


export class DockerApi {
    // we use the oldest version of the API that supports all the features we want
    // to be compatible with most versions.
    public static DEFAULT_VERSION = "v1.22";
    public static DEFAULT_SOCKET_PATH = "/var/run/docker.sock";
    public static DEFAULT_HEADERS = {
        "Accept": "application/json",
        "Accept-Encoding": "identity"
    };

    private socket_client: UnixHttpSocket;

    constructor(
        socket_path: string = DockerApi.DEFAULT_SOCKET_PATH,
        private api_version = DockerApi.DEFAULT_VERSION
    ) {
        this.socket_client = new UnixHttpSocket(socket_path);
    }

    private get(endpoint: `/${string}`): Promise<Response> {
        return this.socket_client.fetch(`http://localhost/${this.api_version}${endpoint}`, { headers: DockerApi.DEFAULT_HEADERS });
    }

    async get_version(): Promise<DockerVersionReponse> {
        const response = await this.get("/version");
        return response.json();
    }

    async get_info(): Promise<DockerInfoResponse> {
        const response = await this.get("/info");
        return response.json();
    }

    async get_containers(): Promise<DockerContainerResponse> {
        const response = await this.get("/containers");
        return response.json();
    }

    async subscribe_events(): Promise<AsyncGenerator<DockerEvent>> {
        const http_stream = await this.socket_client.fetch(`http://localhost/${this.api_version}/events`, { headers: DockerApi.DEFAULT_HEADERS });
        const http_stream_reader = http_stream.body!.getReader();
        const reader = new io.BufReader(streams.readerFromStreamReader(http_stream_reader));
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
