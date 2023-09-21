import { log } from "./deps.ts";

import { DockerApi } from "./lib/docker-api.ts";
import { LockFile, LockFileRegisterStatus } from "./lib/lockfile.ts";
import { ALL_NOTIFIERS, Notifier } from "./lib/notifiers.ts";


const lock_file_path = "/var/run/dolce/lock.json";

const log_level: log.LevelName = Deno.env.get("DOLCE_LOG_LEVEL") as log.LevelName ?? "INFO";
log.setup({
    handlers: {
        default: new log.handlers.ConsoleHandler(log_level, { formatter: "{levelName} {loggerName}: {msg}" })
    },
    loggers: {
        main: { level: log_level, handlers: ["default"] },
        notifier: { level: log_level, handlers: ["default"] }
    },
});
const logger = log.getLogger("main");

logger.info(`starting dolce container monitor v0.1.0`);

const lockfile = new LockFile(lock_file_path);
lockfile.register((status, lock_file_path, lock_file_contents) => {
    switch (status) {
        case LockFileRegisterStatus.Success:
            logger.info(`created lockfile ${lock_file_path} for pid ${lock_file_contents!.pid}`);
            break;
        case LockFileRegisterStatus.SuccessOldLockfileFound:
            logger.warning(`found old but stale lockfile ${lock_file_path} for pid ${lock_file_contents!.pid} that is no longer running.
            Last seen at ${lock_file_contents!.last_update.toLocaleString()}`);
            // ToDo: notify about restart
            break;
        case LockFileRegisterStatus.FailAnotherProcessRunning:
            logger.error(`another process with PID ${lock_file_contents!.pid} is already running!`);
            Deno.exit(0);
            break;
    }
});

const docker_api_socket = Deno.env.get("DOCKER_SOCKET") ?? DockerApi.DEFAULT_SOCKET_PATH;
logger.debug(`connecting to Docker API socket at ${docker_api_socket}`);
const api = await new DockerApi(docker_api_socket);
const docker_version = await api.get_version();
const docker_host_info = await api.get_info();
logger.info(`connected to Docker ${docker_version.Version} (API: ${docker_version.ApiVersion})`);

const event_stream = await api.subscribe_events();

const installed_notifiers = ALL_NOTIFIERS.map(notifier => notifier.try_create(docker_host_info.Name)).filter(posiibleNotifier => posiibleNotifier instanceof Notifier);
console.log(installed_notifiers);
for await (const event of event_stream) {
    if (event.Type == "container") {
        installed_notifiers.forEach(notifier => notifier?.add_event(event));
    }
}


console.log("done");
