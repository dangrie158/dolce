import { getLogger } from "@std/log";
import * as path from "@std/path";
import { throttle } from "./async.ts";

type LockFileInformation = {
    last_update: Date;
    pid: number;
};
type LockFileRegisterCallback = (
    status: LockFileRegisterStatus,
    lock_file_path: string,
    lock_file_contents?: LockFileInformation,
) => void;

export enum LockFileRegisterStatus {
    Success,
    SuccessOldLockfileFound,
    FailAnotherProcessRunning,
}

export class LockFile {
    static UPDATE_THROTTLE_INTERVAL = 1000;
    static get logger() {
        return getLogger("lockfile");
    }

    private lock_file_path: string;

    constructor(run_directory: string) {
        this.lock_file_path = path.join(run_directory, "lockfile");
    }

    async register(status_callback: LockFileRegisterCallback) {
        // check if another lockfile exists
        if (await this.exists()) {
            let status = LockFileRegisterStatus.SuccessOldLockfileFound;
            let lock_file_information: LockFileInformation | undefined;
            try {
                lock_file_information = await this.read_contents();
                // check if the other process is still running
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
        addEventListener("unload", this.unload_handler);

        // shutdown gracefully on SIGTERM as this is the signal send to the process by `docker stop`
        // https://docs.docker.com/engine/reference/commandline/stop/
        Deno.addSignalListener("SIGTERM", this.terminate_handler);
        // also support SIGINT since it is the default signal fired when Ctrl+C on a keyboard
        Deno.addSignalListener("SIGINT", this.terminate_handler);

        status_callback(LockFileRegisterStatus.Success, this.lock_file_path, lock_file_information);
    }

    async unregister() {
        Deno.removeSignalListener("SIGTERM", this.terminate_handler);
        removeEventListener("unload", this.unload_handler);
        await this.remove();
    }

    async update(): Promise<LockFileInformation> {
        const info: LockFileInformation = {
            last_update: new Date(),
            pid: Deno.pid,
        };
        await Deno.writeTextFile(this.lock_file_path, JSON.stringify(info));
        return info;
    }

    throttled_update = throttle(async () => {
        await this.update();
    }, LockFile.UPDATE_THROTTLE_INTERVAL);

    async exists(): Promise<boolean> {
        try {
            await Deno.stat(this.lock_file_path);
        } catch {
            return false;
        }
        return true;
    }

    async remove() {
        await Deno.remove(this.lock_file_path);
    }

    private terminate_handler: () => void = () => {
        LockFile.logger.info("received SIGTERM or SIGINT, gracefully shutting down");
        Deno.exit(0);
    };

    private unload_handler: () => Promise<void> = async () => {
        LockFile.logger.info(`removing lockfile "${this.lock_file_path}"`);
        await this.remove();
    };

    private async read_contents(): Promise<LockFileInformation> {
        const lockfile_contents = await Deno.readTextFile(this.lock_file_path);
        const lock_file_information = JSON.parse(lockfile_contents);
        return {
            pid: lock_file_information.pid,
            last_update: new Date(lock_file_information.last_update),
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
