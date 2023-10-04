# Docker Live Container Events

![Dolce logo](https://dangrie158.github.io/dolce/master/assets/logo_full.svg)

![current release](https://img.shields.io/github/v/tag/dangrie158/dolce)
![build status](https://img.shields.io/github/actions/workflow/status/dangrie158/dolce/ci.yml)
![licence: MIT](https://img.shields.io/github/license/dangrie158/dolce?logo=reacthookform&logoColor=white)
![docker pulls](https://img.shields.io/docker/pulls/dangrie158/dolce?logo=docker)

## Features

Get notified if something (bad) happens to your containers. Supports the following notification options:

- EMail via SMTP
- Discord via WebHooks
- Telegram via the Bot API

All Notifications use a exponential backoff algorithm to avoid spamming you with messages if a container decides to go
into a restart loop.

## Documentation

[Check the documentation](https://dangrie158.github.io/dolce/) for a full list of features. The documentation is also
versioned for [old versions](https://github.com/dangrie158/dolce/tags).

## Example

```yaml
version: "3"
services:
  importantservice:
    image: "ubuntu:latest"
    command: "sleep 1; exit 0;"
    restart: unless-stopped

  dolce:
    image: dangrie158/dolce:v2.3.0
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
        DISCORD_WEBHOOK: https://ptb.discord.com/api/webhooks/<YOUR_WEBHOOK>
```
