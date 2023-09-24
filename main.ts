import { log } from "./deps.ts";

import { DockerApi, DockerContainerEvent, DockerEventFilters } from "./lib/docker-api.ts";
import { LockFile, LockFileRegisterStatus } from "./lib/lockfile.ts";
import { ALL_NOTIFIERS, Notifier } from "./lib/notifiers.ts";


const lock_file_path = "/var/run/dolce/lockfile";
const startup_time = new Date();
const event_filters: DockerEventFilters = {
    type: ["container"],
    event: ["start", "die", "kill", "oom", "stop", "pause", "unpause"]
};


// setup logging first so we can output helpful messages
const log_level: log.LevelName = Deno.env.get("DOLCE_LOG_LEVEL") as log.LevelName ?? "INFO";
log.setup({
    handlers: {
        default: new log.handlers.ConsoleHandler(log_level, { formatter: "{levelName}\t{loggerName}\t {msg}" })
    },
    loggers: {
        main: { level: log_level, handlers: ["default"] },
        notifier: { level: log_level, handlers: ["default"] },
        lockfile: { level: log_level, handlers: ["default"] }
    },
});
const logger = log.getLogger("main");
logger.info(`starting dolce container monitor v0.1.0`);

// create and register the lockfile, also check if we are already running or experienced an unexpected shutdown
let restart_time: Date | undefined;
const lockfile = new LockFile(lock_file_path);
await lockfile.register((status, lock_file_path, lock_file_contents) => {
    switch (status) {
        case LockFileRegisterStatus.Success:
            logger.info(`created lockfile ${lock_file_path} for pid ${lock_file_contents!.pid}`);
            break;
        case LockFileRegisterStatus.SuccessOldLockfileFound:
            logger.warning(`found old but stale lockfile ${lock_file_path} for pid ${lock_file_contents!.pid} that is no longer running.
            Last seen at ${lock_file_contents!.last_update.toLocaleString()}`);
            restart_time = lock_file_contents!.last_update;
            break;
        case LockFileRegisterStatus.FailAnotherProcessRunning:
            logger.error(`another process with PID ${lock_file_contents!.pid} is already running!`);
            Deno.exit(0);
    }
});


// connect to the docker API
const docker_api_socket = Deno.env.get("DOCKER_SOCKET") ?? DockerApi.DEFAULT_SOCKET_PATH;
logger.debug(`connecting to Docker API socket at ${docker_api_socket}`);
const api = new DockerApi(docker_api_socket);
const docker_version = await api.get_version();
const docker_host_info = await api.get_info();
logger.info(`connected to Docker ${docker_version.Version} (API: ${docker_version.ApiVersion})`);

// create all the notifiers that are setup via the environment
const installed_notifiers = ALL_NOTIFIERS
    .map(notifier => notifier.try_create(docker_host_info.Name))
    .filter(posiibleNotifier => posiibleNotifier !== undefined) as Notifier[];

// restore the notifier state if we we're shutdown unexpectedly
installed_notifiers.map(async notifier => await notifier.restore_from_wal());

// check if we encountered an unexpected shutdown since last start
if (restart_time !== undefined) {
    // send notification about the restart
    const missed_events_stream = await api.subscribe_events({
        since: restart_time,
        until: startup_time,
        filters: event_filters
    });

    const missed_events = [];
    for await (const event of missed_events_stream) missed_events.push(event as DockerContainerEvent);
    const restart_information = {
        downtime_start: restart_time,
        downtime_end: startup_time,
        events_since_shutdown: missed_events
    };
    logger.info(`sending notification about unexpected shutdown at ${restart_time.toLocaleString()} with ${missed_events.length} missed events since then`);
    installed_notifiers.forEach(async notifier => {
        try {
            await notifier.notify_about_restart(restart_information);
        } catch (error) {
            logger.error(`failed to send notification with ${notifier.constructor.name}: ${error}`);
        }
    });
}

const event_stream = await api.subscribe_events({
    since: startup_time,
    filters: event_filters
});
for await (const event of event_stream) {
    logger.info(`new container event received: <"${event.from}": ${event.Action}>`);
    installed_notifiers.forEach(async notifier => await notifier.add_event(event as DockerContainerEvent));
    await lockfile.throttled_update();
}
