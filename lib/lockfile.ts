
import { path, async } from "../deps.ts";

type LockFileInformation = {
    last_update: Date,
    pid: number;
};
type LockFileRegisterCallback = (status: LockFileRegisterStatus, lock_file_path: string, lock_file_contents?: LockFileInformation) => void;

export enum LockFileRegisterStatus {
    Success,
    SuccessOldLockfileFound,
    FailAnotherProcessRunning,
}

export class LockFile {
    static DebounceInterval = 1000;

    private terminateHandler: () => void = () => Deno.exit(0);
    private unloadHandler: () => void = () => this.remove();

    constructor(private lock_file_path: string) { }

    async register(status_callback: LockFileRegisterCallback) {
        // check if another lockfile exists
        if (await this.exists()) {
            let status = LockFileRegisterStatus.SuccessOldLockfileFound;
            let lock_file_information: LockFileInformation | undefined;
            try {
                lock_file_information = await this.read_contents();
                if (this.is_process_running(lock_file_information.pid)) {
                    status = LockFileRegisterStatus.FailAnotherProcessRunning;
                }
            } finally {
                status_callback(status, this.lock_file_path, lock_file_information);
            }
        }

        //create the lockfile
        Deno.mkdir(path.dirname(this.lock_file_path), { recursive: true });
        const lock_file_information = await this.update();

        // delete the lockfile if this process stops gracefully
        addEventListener("unload", this.unloadHandler);

        // shutdown gracefully on SIGTERM as this is the signal send to the process by `docker stop`
        // https://docs.docker.com/engine/reference/commandline/stop/
        Deno.addSignalListener("SIGTERM", this.terminateHandler);

        status_callback(LockFileRegisterStatus.Success, this.lock_file_path, lock_file_information);
    }

    async unregister() {
        Deno.removeSignalListener("SIGTERM", this.terminateHandler);
        removeEventListener("unload", this.unloadHandler);
        await this.remove();
    }

    async update(): Promise<LockFileInformation> {
        const info: LockFileInformation = {
            last_update: new Date(),
            pid: Deno.pid
        };
        await Deno.writeTextFile(this.lock_file_path, JSON.stringify(info));
        return info;
    }

    debounced_update = async.debounce(async () => await this.update(), LockFile.DebounceInterval);

    async exists(): Promise<boolean> {
        try {
            await Deno.stat(this.lock_file_path);
        } catch {
            return false;
        }
        return true;
    }

    private async remove() {
        await Deno.remove(this.lock_file_path);
    }
    private async read_contents(): Promise<LockFileInformation> {
        const lockfile_contents = await Deno.readTextFile(this.lock_file_path);
        const lock_file_information = JSON.parse(lockfile_contents);
        return {
            pid: lock_file_information.pid,
            last_update: new Date(lock_file_information.last_update)
        };
    }

    private is_process_running(pid: number) {
        try {
            Deno.kill(pid, "SIGINFO");
        } catch {
            return false;
        }
        return true;
    }

}
