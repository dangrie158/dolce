---
title: Configuration
icon: material/cog
---

# Configuration

Configuration of the service is done via environment variables.

## General Configuration

| Name                     | Type                                                                   | Default                | Description                                                                          |
| ------------------------ | ---------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| `DOLCE_LOG_LEVEL`        | [Deno Log Level](https://deno.land/std@0.202.0/log/mod.ts?s=LogLevels) | `INFO`                 | Loglevel of the service                                                              |
| `DOCKER_HOST`            | `string?`                                                              | `/var/run/docker.sock` | Path to the docker socket or an `ip:port`-pair when used with `DOCKER_TRANSPORT=tcp` |
| `DOCKER_TRANSPORT`       | `unix` \| `tcp`                                                        | `unix`                 | Transport used to talk to docker                                                     |
| `DOLCE_SUPERVISION_MODE` | `ALL` \| `TAGGED`                                                      | `ALL`                  | See [supervision mode](#supervision-mode)                                            |

## Supervision Mode

If the variable `DOLCE_SUPERVISION_MODE` is set to the string `TAGGED`, only containers with the tag `dolce.enabled` and
a value of true will create events. If instead set to `ALL` or unset, all containers are supervised.

```yaml title="Example using DOLCE_SUPERVISION_MODE=TAGGED"
services:
importatntservice:
  ...# will create notifications
  labels:
    dolce.enabled: true
unimportatntservice:
  ...# won't create notifications
  labels:
    dolce.enabled: false
anotherunimportantservice:
  ...# won't create notifications
dolce:
  image: dangrie158/dolce
  ...
  environment:
    DOLCE_SUPERVISION_MODE: TAGGED
```
