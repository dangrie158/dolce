---
title: Configuration
icon: material/cog
---

# Configuration

Configuration of the service is done via environment variables.

## General Configuration

| Name                         | Type                          | Default                        | Description                                                                                    |
| ---------------------------- | ----------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `DOLCE_LOG_LEVEL`            | Deno Log Level [^1]           | `INFO`                         | Loglevel of the service                                                                        |
| `DOCKER_HOST`                | `string?`                     | `/var/run/docker.sock`         | Path to the docker socket or an `ip:port`-pair when used with `DOCKER_TRANSPORT=tcp`           |
| `DOCKER_TRANSPORT`           | `unix` \| `tcp`               | `unix`                         | Transport used to talk to docker                                                               |
| `DOLCE_IDENTIFIER_LABEL`     | `string?`                     | `dolce.identifier`             | See [Container Identifiers](#container-identifiers)                                            |
| `DOLCE_SUPERVISION_MODE`     | SupervisorMode [^2]           | `ALL`                          | See [Supervision Mode](#supervision-mode)                                                      |
| `DOLCE_SUPERVISION_LABEL`    | `string?`                     | `dolce.enabled`                | See [Supervision Mode](#supervision-mode)                                                      |
| `DOLCE_SUPERVISION_PREFIX`   | `string?`                     | `temp-`                        | See [Supervision Mode](#supervision-mode)                                                      |
| `DOLCE_ACTOR_IDENTIFIER`     | `name` \| `image`             | `name`                         | See [Container Identifiers](#container-identifiers)                                            |
| `DOLCE_EVENTS`               | Container Action[] [^3]       | All available                  | See [Event Selection](#event-selection)                                                        |
| `DOLCE_BLACKOUT_WINDOWS`     | [PlainTime, PlainTime][] [^3] | []                             | See [Blackout Times](#blackout-times)                                                          |
| `DOLCE_MIN_TIMEOUT`          | `number`                      | 10                             | See [Notification Backoff](./advanced/notification-backoff.md)                                 |
| `DOLCE_MAX_TIMEOUT`          | `number`                      | 60*60*24                       | See [Notification Backoff](./advanced/notification-backoff.md)                                 |
| `DOLCE_MULTIPLIER`           | `number`                      | 10                             | See [Notification Backoff](./advanced/notification-backoff.md)                                 |
| `DOLCE_RUN_DIRECTORY`        | `string`                      | `/var/run/dolce/`              | Path where the event registry and [lockfile](#lockfile) are stored                             |
| `DOLCE_CUSTOM_TEMPLATE_PATH` | `string?`                     | `/var/dolce-custom-templates/` | See [Custom Templates](./advanced/custom-templates.md)                                         |
| `DOLCE_DEBUG`                | `boolean?`                    | `false`                        | Set to `true` during development to avoid problems with the [Lockfile](#lockfile) in watchmode |

[^1]: [Deno Log Level](https://deno.land/std@0.202.0/log/mod.ts?s=LogLevels)

[^2]: [SupervisionMode](https://github.com/search?q=repo%3Adangrie158/dolce%20SupervisorMode&type=code)

[^3]: [Container Action](https://docs.docker.com/engine/api/v1.27/#tag/System/operation/SystemEvents)

## Supervision Mode

Using the `DOLCE_SUPERVISION_MODE` environment variable you can control which containers are supervised by Dolce. If set
to any other value than `ALL` (the default), Dolce will ignore events by containers that do not match the rules
described below:

### `TAGGED` and `UNTAGGED`

If the variable `DOLCE_SUPERVISION_MODE` is set to the string `TAGGED`, only containers with the tag specified in
`DOLCE_SUPERVISION_LABEL` and a value of **exactly** `true` will create events (Note that docker tag values are always
strings, so no YAML booleans and the (Norway problem)[https://hitchdev.com/strictyaml/why/implicit-typing-removed/]).

`UNTAGGED` is the logical inverse: only containers without the tag set to exactly `true` will create events. In this
case it is useful to change the default value of `DOLCE_SUPERVISION_LABEL` to e.g. `dolce.disabled` to have a meaningful
name for the tag, although this is not required. Go ahead and confuse yourself :wink:

The value of `DOLCE_SUPERVISION_PREFIX` and container names is in both cases irrelevant.

```yaml title="Example using DOLCE_SUPERVISION_MODE=TAGGED"
services:
    dolce:
        image: dangrie158/dolce
            ...
        environment:
            DOLCE_SUPERVISION_MODE: TAGGED
            DOLCE_SUPERVISION_LABEL: monitor.enable
    importantservice:
        labels:
            monitor.enable: true # (1)!
    unimportantservice:
        labels:
            monitor.enable: false # (2)!
    anotherunimportantservice:
        ... # (3)!
```

1. will create notifications, the label is set to exactly "true"
2. won't create notifications, the label is explicitly set to a value other than "true"
3. won't create notifications, the label is not set at all

### `PREFIXED` and `NOTPREFIXED`

If the variable `DOLCE_SUPERVISION_MODE` is set to the string `PREFIXED`, only containers with a name that starts with
the value of `DOLCE_SUPERVISION_PREFIX` will create events. Events by all other containers are ignored.

`NOTPREFIXED` is the logical inverse: all containers will create events **except** they are prefixed with the value in
`DOLCE_SUPERVISION_PREFIX`.

The value of `DOLCE_SUPERVISION_LABEL` and any container tags is in both cases irrelevant.

## Container Identifiers

By default Dolce will use the container name in notifications to identify the container that changed the state. If you
set `DOLCE_ACTOR_IDENTIFIER` to `image`, the name of the dockerimage is used instead. You can also specify a custom
identifier per container by adding a label with the key specified in `DOLCE_IDENTIFIER_LABEL` to your container.

For example:

```yaml title="Example using DOLCE_ACTOR_IDENTIFIER=image and a custom DOLCE_IDENTIFIER_LABEL"
services:
    dolce:
        image: dangrie158/dolce
            ...
        environment:
            DOLCE_ACTOR_IDENTIFIER: image
            DOLCE_IDENTIFIER_LABEL: dolce.label # (1)!
    importantservice:
        labels:
            dolce.label: "my_important_service_do_not_kill" # (2)!
    anotherimportantservice:
        ... # (3)!
```

1. `dolce.identifier` by default
2. using the label specified in `DOLCE_IDENTIFIER_LABEL`, this container will be referred to as
   `my_important_service_do_not_kill` in any notifications
3. This container will be referred to by its image name due to the setting of `DOLCE_ACTOR_IDENTIFIER=image`

## Event Selection

By default you will get notified for a subset of all available events that are fired by the Docker Engine: `start`

- `die`
- `kill`
- `oom`
- `stop`
- `pause`
- `unpause`
- `health_status`

You can narrow this list down or expand it by setting the `DOLCE_EVENTS` setting. If you are for example only interested
in `die` and `start` events you can set:

```yaml
dolce:
    image: dangrie158/dolce
        ...
    environment:
        DOLCE_EVENTS: die,start
```

This is the list of all available events:

`attach`, `commit`, `copy`, `create`, `destroy`, `detach`, `die`, `exec_create`, `exec_detach`, `exec_start`, `export`,
`health_status`, `kill`, `oom`, `pause`, `rename`, `resize`, `restart`, `start`, `stop`, `top`, `unpause`, `update`.

## Blackout Times

You can specify a list of time ranges in which all events should be ignored. This is useful if you have a maintenance
window or if you regularly stop and start containers for some reason. The format is `HH:[MM[:SS]]-HH:[MM[:SS]]` and you
can specify multiple ranges by separating them with a comma.

```yaml
dolce:
    image: dangrie158/dolce
        ...
    environment:
        DOLCE_BLACKOUT_WINDOWS: 02:00-04:00,22:00-23:59
```

If the blackout window ends, the status of all containers is compared to the last known state and notifications are sent
if any container is in a different state than before. This enables you to schedule automatic container updates in a
specified window and still get notified if something goes wrong during the update process.

## Run Directory

If you plan on using multiple instances of Dolce (e.g. to enable multiple configurations) make sure that if this is
mounted in a volume, no two different services access the same file.

### Lockfile

The lockfile is used to detect unexpected shutdowns and avoid mutliple instances of the service running at the same
time. It is located at `${DOLCE_RUN_DIRECTORY}/lockfile` You can mount this path in a volume to detect unexpected
shutdowns outside of the lifetime of the container.

## Use Local Timezone for Eventdates

By default, dolce uses the UTC timezone for all eventdates. This is a good default because it is the same timezone that
the docker API uses. However, if you want to use the local timezone of the host, you can set the `TZ` environment
variable to the desired timezone.

```yaml
services:
  dolce:
    image: dangrie158/dolce:v2.10.7
    restart: unless-stopped
    environment:
      ...
      TZ: Europe/Berlin
```
