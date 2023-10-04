---
title: Quickstart
icon: material/clock-fast
---

## Getting Started

You can simply add dolce as an additional service to your :simple-docker: `docker-compose.yml`.

```yaml title="docker-compose.yml"
version: "3"
services:
  importantservice: # (1)!
    image: "ubuntu:latest"
    command: "sleep 1; exit 0;"
    restart: unless-stopped

  dolce:
    image: dangrie158/dolce:v2.2.0
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock # (2)!
    environment: # (3)!
        # get notified via email
        SMTP_HOSTNAME: smtp.gmail.com # (4)!
        SMTP_RECIPIENTS: incidents@example.com:personal@gmail.com

        # get notified via Discord
        DISCORD_WEBHOOK: https://ptb.discord.com/api/webhooks/<YOUR_WEBHOOK>

        # get notified via Telegram
        TELEGRAM_HTTP_TOKEN: 123456789123456:AABBCCDDEEFFGGHHIIJJKKLLMM
        TELEGRAM_RECIPIENT_IDS: 12345678912:456789123
    restart: unless-stopped # (5)!
```

1. Just for demonstration to generate some _interesting_ events
2. Dolce needs access to the docker host which is easiest mounting the docker socket inside the container. If you don't
   want to give this level of access, see [how to run with reduced permissions](advanced/reduced-permissions.md).
3. or use a .env file
4. see [how to setup using the GMail SMTP server](notifiers/smtp.md#setup-gmail-as-your-smtp-server)
5. Dolce handles restarts gracefully and tries to recover any messages that may happened while the service was down

This example will monitor all your containers with all events meaning you will get notifications if any new containers
are created or the state of any running container changes.
