
import { log } from "./deps.ts";

import { DockerApi } from "./lib/docker-api.ts";
import { ALL_NOTIFIERS } from "./lib/notifiers.ts";

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

const docker_api_socket = Deno.env.get("DOCKER_SOCKET") ?? DockerApi.DEFAULT_SOCKET_PATH;
logger.debug(`connecting to Docker API socket at ${docker_api_socket}`);
const api = await new DockerApi();
const docker_version = await api.get_version();
logger.info(`connected to Docker ${docker_version.Version} (API: ${docker_version.ApiVersion})`);

const event_stream = await api.subscribe_events();

ALL_NOTIFIERS.forEach(notifier => notifier.try_create());

for await (const event of event_stream) {
    console.log(event.Action);
}


console.log("done");
