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

---

## Features

Get notified if something (bad) happens to your containers. Supports the following notification options:

<div class="grid cards two-column" markdown>
- [:material-email: **EMail** with your own SMTP Server](./notifiers/smtp.md)
- [:simple-discord: **Discord** via WebHooks](./notifiers/discord.md)
- [:simple-telegram: **Telegram** via the Bot API](./notifiers/telegram.md)
- [:material-bell: ...and many more](./notifiers/apprise.md)
</div>

All Notifications use a exponential backoff algorithm to avoid spamming you with messages if a container decides to go
into a restart loop.

---

Dolce comes with sensible defaults so you can use it out of the box but also letz you configure most aspects of it in an
easy fashion if you so desire:

<div class="grid cards single-column" markdown>
- [:material-cog: **Configurable** via Environment Variables](./configuration.md)
- [:material-database-clock: **Notification Backoff** so you don't get spammed.](./advanced/notification-backoff.md)
- [:material-database-lock: **Graceful Error Handling** No events are lost, even if the service gets shut down](./configuration.md)
- [:material-email-edit: **Custom Templates** for your notifications with your design](./advanced/custom-templates.md)
</div>

## Example

```yaml title="docker-ompose.yml"
version: "3"
services:
  dolce:
    image: dangrie158/dolce:v2.4.0 # (1)!
    restart: unless-stopped # (2)!
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock # (3)!
    environment:
        DISCORD_WEBHOOK: https://ptb.discord.com/api/webhooks/<YOUR_WEBHOOK> # (4)!

  importantservice: # (5)!
    image: "ubuntu:latest"
    command: "sleep 1; exit 0;"
    restart: unless-stopped

  dolce:
    image: dangrie158/dolce:v2.5.0
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
        DISCORD_WEBHOOK: https://discord.com/api/webhooks/<YOUR_WEBHOOK>
```

1. You can use the `:latest` stable version or even `:master`
2. Its a good idea to start again if something bad happens. Dolce won't loose any data about restarts and sends you a
   notification if an unexpected restart of its conainer happened. It even tries to gather the events it missed while
   the container was down.
3. Or [connect over a proxy](./advanced/reduced-permissions.md) to not expose the whole docker socket to the container.
4. Configuration of the notifications is done over environment variables, so no need for external configuration files
   that clutter your project.
5. By default all services are monitored, but you of course can [configure](./configuration.md) this behaviour.
