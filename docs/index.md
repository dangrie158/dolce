---
title: Dolce
icon: material/home
---

![Dolce logo](assets/logo_full.svg)

![current release](https://img.shields.io/github/v/tag/dangrie158/dolce)
![build status](https://img.shields.io/github/actions/workflow/status/dangrie158/dolce/ci.yml)
![licence: MIT](https://img.shields.io/github/license/dangrie158/dolce?logo=reacthookform&logoColor=white)
![docker pulls](https://img.shields.io/docker/pulls/dangrie158/dolce?logo=docker)

# **Do**cker **L**ive **C**ontainer **E**vents {: .hero-header }

## Features

Get notified if something (bad) happens to your containers. Supports the following notification options:

<div class="grid cards" markdown>
- :material-email: **EMail** With your own SMTP Server
- :simple-discord: **Discord** via WebHooks
- :simple-telegram: **Telegram** via the Bot API
- :material-bell: ...and many more
</div>

All Notifications use a exponential backoff algorithm to avoid spamming you with messages if a container decides to go
into a restart loop.

## Example

```yaml
version: "3"
services:
  importatntservice:
    image: "ubuntu:latest"
    command: "sleep 1; exit 0;"
    restart: unless-stopped

  dolce:
    image: dangrie158/dolce:v2.2.0
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
        DISCORD_WEBHOOK: https://ptb.discord.com/api/webhooks/<YOUR_WEBHOOK>
```
