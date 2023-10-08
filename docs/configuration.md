---
title: Configuration
icon: material/cog
---

# Configuration

Configuration of the service is done via environment variables.

## General Configuration

| Name                        | Type                    | Default                        | Description                                                                          |
| --------------------------- | ----------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| `DOLCE_LOG_LEVEL`           | Deno Log Level [^1]     | `INFO`                         | Loglevel of the service                                                              |
| `DOCKER_HOST`               | `string?`               | `/var/run/docker.sock`         | Path to the docker socket or an `ip:port`-pair when used with `DOCKER_TRANSPORT=tcp` |
| `DOCKER_TRANSPORT`          | `unix` \| `tcp`         | `unix`                         | Transport used to talk to docker                                                     |
| `DOLCE_SUPERVISION_LABEL`   | `string?`               | `dolce.enabled`                | See [Supervision Mode](#supervision-mode)                                            |
| `DOLCE_SUPERVISION_MODE`    | `ALL` \| `TAGGED`       | `ALL`                          | See [Supervision Mode](#supervision-mode)                                            |
| `DOLCE_EVENTS`              | Container Action[] [^2] | All available                  | See [Event Selection](#event-selection)                                              |
| `DOLCE_MIN_TIMEOUT`         | `number`                | 10                             | See [Notification Backoff](./advanced/notification-backoff.md)                       |
| `DOLCE_MAX_TIMEOUT`         | `number`                | 60*60*24                       | See [Notification Backoff](./advanced/notification-backoff.md)                       |
| `DOLCE_MULTIPLIER`          | `number`                | 10                             | See [Notification Backoff](./advanced/notification-backoff.md)                       |
| `DOLCE_LOCKFILE`            | `string`                | `/var/run/dolce/lockfile`      | See [Lockfile](#lockfile)                                                            |
| `DOLCE_CUSTOM_TEPLATE_PATH` | `string?`               | `/var/dolce-custom-templates/` | See [Custom Templates](./advanced/custom-templates.md)                               |

[^1]: [Deno Log Level](https://deno.land/std@0.202.0/log/mod.ts?s=LogLevels)

[^2]: [Container Action](https://docs.docker.com/engine/api/v1.27/#tag/System/operation/SystemEvents)

## Supervision Mode

If the variable `DOLCE_SUPERVISION_MODE` is set to the string `TAGGED`, only containers with the tag specified in
`DOLCE_SUPERVISION_LABEL` and a value of true will create events. If instead set to `ALL` or unset, all containers are
supervised.

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
    DOLCE_EVENTS: die:start
```

This is the list of all available events:

`attach`, `commit`, `copy`, `create`, `destroy`, `detach`, `die`, `exec_create`, `exec_detach`, `exec_start`, `export`,
`health_status`, `kill`, `oom`, `pause`, `rename`, `resize`, `restart`, `start`, `stop`, `top`, `unpause`, `update`.

## Lockfile

The lockfile is used to detect unexpected shutdowns and avoid mutliple instances of the service running at the same
time. You can mount this path in a volume to detect unexpected shutdowns outside of the lifetime of the container.

If you plan on using multiple instances of Dolce (e.g. to enable multiple configurations) make sure that if this is
mounted in a volume, no two different services access the same file.
