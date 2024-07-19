import { log } from "./deps.ts";

import { DockerApi, DockerApiContainerEvent, DockerApiEvent, DockerApiEventFilters } from "./lib/docker-api.ts";
import { LockFile, LockFileRegisterStatus } from "./lib/lockfile.ts";
import { ALL_NOTIFIERS, Notifier, try_create } from "./lib/notifiers.ts";
import { add_event, get_next_delivery, register as register_events } from "./lib/event_registry.ts";
import { Configuration } from "./configuration.ts";

const startup_time = new Date();
const logger = log.getLogger("main");
logger.info(`starting dolce container monitor v2.10.8`);

if (!Configuration.is_valid) {
    logger.error(`configuration invalid found:`);
    for (const [key, error] of Object.entries(Configuration.errors)) {
        logger.error(`\t${key}: ${error}`);
    }
    Deno.exit(1);
} else {
    logger.debug(`loaded configurations: ${Configuration}`);
}
// create and register the lockfile, also check if we are already running or experienced an unexpected shutdown
let restart_time: Date | undefined;
const lockfile = new LockFile(Configuration.lockfile_path);
await lockfile.register((status, lock_file_path, lock_file_contents) => {
    switch (status) {
        case LockFileRegisterStatus.Success:
            logger.info(`created lockfile ${lock_file_path} for pid ${lock_file_contents!.pid}`);
            break;
        case LockFileRegisterStatus.SuccessOldLockfileFound:
            logger.warn(
                `found old but stale lockfile ${lock_file_path} for pid \
                ${lock_file_contents!.pid} that is no longer running. \
                Last seen at ${lock_file_contents!.last_update.toLocaleString()}`,
            );
            restart_time = lock_file_contents!.last_update;
            break;
        case LockFileRegisterStatus.FailAnotherProcessRunning:
            logger.error(`another process with PID ${lock_file_contents!.pid} is already running!`);
            Deno.exit(1);
    }
});

// connect to the docker API
let docker_api_socket: URL;
if (Configuration.docker_host !== undefined) {
    docker_api_socket = new URL(`${Configuration.docker_transport}://${Configuration.docker_host}`);
} else {
    docker_api_socket = DockerApi.DEFAULT_SOCKET_PATH;
}

logger.debug(`connecting to Docker API socket at ${docker_api_socket}`);

const api = new DockerApi(docker_api_socket);
const docker_version = await api.get_version();
const docker_host_info = await api.get_info();
logger.info(`connected to Docker ${docker_version.Version} (API: ${docker_version.ApiVersion})`);

logger.info(`supervision mode set to ${Configuration.supervision_mode}`);

// create all the notifiers that are setup via the environment
const installed_notifiers = ALL_NOTIFIERS.map((notifier) => try_create(notifier, docker_host_info.Name)).filter(
    (posiibleNotifier) => posiibleNotifier !== undefined,
) as Notifier[];

const event_registry = await register_events(async (events, earliest_next_update) => {
    logger.info(`sending events notification to all registered notifiers with ${events.length} events`);
    const notify_promises = installed_notifiers.map(
        async (notifier) => await notifier.notify_about_events(events, earliest_next_update),
    );
    await Promise.all(notify_promises);
    logger.info(`earliest next notification at ${earliest_next_update.toLocaleString()}`);
}, Configuration);

const next_delivery = await get_next_delivery(event_registry);
if (next_delivery !== null) {
    logger.info(`next delivery is scheduled for ${next_delivery?.toLocaleString()}`);
} else {
    logger.info("no delivery scheduled. waiting for events");
}

// setup the event filter for all events we're interested in
const event_filters: DockerApiEventFilters = {
    type: ["container"],
    event: Configuration.events,
};

// check if we encountered an unexpected shutdown since last start
if (restart_time !== undefined) {
    // send notification about the restart
    const missed_events_stream = await api.subscribe_events({
        since: restart_time,
        until: startup_time,
        filters: event_filters,
    });

    const missed_events = [];
    for await (const event of missed_events_stream) missed_events.push(event as DockerApiContainerEvent);
    const restart_information = {
        downtime_start: restart_time,
        downtime_end: startup_time,
        events_since_shutdown: missed_events,
    };
    logger.info(
        `sending notification about unexpected shutdown at ${restart_time.toLocaleString()} with ${missed_events.length} missed events since then`,
    );
    installed_notifiers.forEach(async (notifier) => {
        try {
            await notifier.notify_about_restart(restart_information);
        } catch (error) {
            logger.error(`failed to send notification with ${notifier.constructor.name}: ${error}`);
        }
    });
}

/**
 * checks if a container event should be handled by dolce given the current configuration of the supervision mode
 */
function log_event(event: DockerApiEvent): boolean {
    switch (Configuration.supervision_mode) {
        case "ALL":
            return true;
        case "TAGGED":
            return event.Actor.Attributes[Configuration.supervision_label] === "true";
        case "UNTAGGED":
            return event.Actor.Attributes[Configuration.supervision_label] !== "true";
        case "PREFIXED":
            return event.Actor.Attributes.name.startsWith(Configuration.supervision_prefix);
        case "NOTPREFIXED":
            return !event.Actor.Attributes.name.startsWith(Configuration.supervision_prefix);
    }
}

const shutdown_requested = new AbortController();
Deno.addSignalListener("SIGINT", () => {
    logger.info(`received SIGINT, shutting down dolce container monitor`);
    shutdown_requested.abort();
    Deno.exit(0);
});

let last_connection_lost_time: Date | undefined = undefined;
while (!shutdown_requested.signal.aborted) {
    const event_stream = await api.subscribe_events({
        since: last_connection_lost_time ?? startup_time,
        filters: event_filters,
    });
    for await (const event of event_stream) {
        let event_identifier = event.Actor.Attributes[Configuration.actor_identifier];
        if (Configuration.identifier_label in event.Actor.Attributes) {
            event_identifier = event.Actor.Attributes[Configuration.identifier_label]!;
        }
        logger.info(`new container event received: <"${event_identifier}": ${event.Action}>`);

        if (log_event(event)) {
            await add_event(event_registry, {
                actor_name: event_identifier,
                ...(event as DockerApiContainerEvent),
            });
            await lockfile.throttled_update();
        } else {
            logger.debug(
                `container <"${event_identifier}"> is ignored in current configuration with DOLCE_SUPERVISION_MODE=${Configuration.supervision_mode}, skipping event`,
            );
        }
    }
    last_connection_lost_time = new Date();
    logger.info(`event stream closed unexpectedly, reconnecting in 5 seconds`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
}
logger.info(`dolce container monitor shutdown complete, quitting now.`);
