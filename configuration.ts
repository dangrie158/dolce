import { CheckedConfiguration, ConfigOption, EnvironmentConfiguration } from "./lib/env.ts";
import { log } from "./deps.ts";
import { CONTAINER_ACTIONS, ContainerAction } from "./lib/docker-api.ts";

type SupervisorMode = "ALL" | "TAGGED";

@EnvironmentConfiguration
export class Configuration extends CheckedConfiguration {
    @ConfigOption({ env_variable: "DOLCE_LOG_LEVEL" })
    static readonly loglevel: log.LevelName = "INFO";

    @ConfigOption()
    static readonly docker_host?: string;

    @ConfigOption()
    static readonly docker_transport: string = "unix";

    @ConfigOption({ env_variable: "DOLCE_SUPERVISION_LABEL" })
    static readonly supervision_label: string = "dolce.enabled";

    @ConfigOption({ env_variable: "DOLCE_SUPERVISION_MODE", one_of: ["TAGGED", "ALL"] })
    static readonly supervision_mode: SupervisorMode = "ALL";

    @ConfigOption({ env_variable: "DOLCE_EVENTS", array_of: CONTAINER_ACTIONS })
    static readonly events: ContainerAction[] = [
        "start",
        "die",
        "kill",
        "oom",
        "stop",
        "pause",
        "unpause",
        "health_status",
    ];

    @ConfigOption({ env_variable: "DOLCE_MIN_TIMEOUT" })
    static readonly min_timeout: number = 10;

    @ConfigOption({ env_variable: "DOLCE_MAX_TIMEOUT" })
    static readonly max_timeout: number = 60 * 60 * 24;

    @ConfigOption({ env_variable: "DOLCE_MULTIPLIER" })
    static readonly multiplier: number = 10;

    @ConfigOption({ env_variable: "DOLCE_LOCKFILE" })
    static readonly lockfile_path: string = "/var/run/dolce/lockfile";
}

log.setup({
    handlers: {
        default: new log.handlers.ConsoleHandler(Configuration.loglevel, {
            formatter: "{levelName}\t{loggerName}\t {msg}",
        }),
    },
    loggers: {
        main: { level: Configuration.loglevel, handlers: ["default"] },
        notifier: { level: Configuration.loglevel, handlers: ["default"] },
        lockfile: { level: Configuration.loglevel, handlers: ["default"] },
    },
});
