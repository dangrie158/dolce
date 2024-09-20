import { CheckedConfiguration, ConfigOption, EnvironmentConfiguration } from "./lib/env.ts";
import { log } from "./deps.ts";
import { CONTAINER_ACTIONS, ContainerAction } from "./lib/docker-api.ts";

const SUPERVISION_MODES = ["TAGGED", "UNTAGGED", "PREFIXED", "NOTPREFIXED", "ALL"] as const;
type SupervisorMode = (typeof SUPERVISION_MODES)[number];
type ActorIdentifier = "image" | "name";

@EnvironmentConfiguration
export class Configuration extends CheckedConfiguration {
    @ConfigOption({ env_variable: "DOLCE_LOG_LEVEL" })
    static readonly loglevel: log.LevelName = "INFO";

    @ConfigOption()
    static readonly docker_host?: string;

    @ConfigOption()
    static readonly docker_transport: string = "unix";

    @ConfigOption({ env_variable: "DOLCE_IDENTIFIER_LABEL" })
    static readonly identifier_label: string = "dolce.identifier";

    @ConfigOption({
        env_variable: "DOLCE_SUPERVISION_MODE",
        one_of: SUPERVISION_MODES,
    })
    static readonly supervision_mode: SupervisorMode = "ALL";

    @ConfigOption({ env_variable: "DOLCE_SUPERVISION_LABEL" })
    static readonly supervision_label: string = "dolce.enabled";

    @ConfigOption({ env_variable: "DOLCE_SUPERVISION_PREFIX" })
    static readonly supervision_prefix: string = "temp-";

    @ConfigOption({ env_variable: "DOLCE_ACTOR_IDENTIFIER", one_of: ["image", "name"] })
    static readonly actor_identifier: ActorIdentifier = "name";

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

    @ConfigOption({ env_variable: "DOLCE_CUSTOM_TEMPLATE_PATH" })
    static readonly custom_template_path: string = "/var/dolce-custom-templates/";

    @ConfigOption({ env_variable: "DOLCE_DEBUG" })
    static readonly debug: boolean = false;

    static toString() {
        return `\nConfiguration {
            ${
            Object.entries(Configuration)
                .map(([key, value]) => `\t${key}: ${value}`)
                .join(",\n")
        }
        }`;
    }
}

log.setup({
    handlers: {
        default: new log.ConsoleHandler(Configuration.loglevel, {
            formatter: (record) => `${record.levelName}\t${record.loggerName}\t ${record.msg}`,
        }),
    },
    loggers: {
        main: { level: Configuration.loglevel, handlers: ["default"] },
        notifier: { level: Configuration.loglevel, handlers: ["default"] },
        lockfile: { level: Configuration.loglevel, handlers: ["default"] },
    },
});
