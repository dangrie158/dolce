---
title: Slack
icon: simple/slack
---

# Slack Notifications

Slack is currently supported through [Apprise](./apprise.md). See
[the documentation](https://github.com/caronc/apprise/wiki/Notify_slack) for all posible options.

An example configuration is:

```yaml
services:
    apprise: # (1)!
        image: caronc/apprise:latest

    dolce:
        image: dangrie158/dolce:v4.0.0
        restart: unless-stopped
        volumes:
            - /var/run/docker.sock:/var/run/docker.sock
        environment:
            APPRISE_HOST: apprise:8000
            APPRISE_URLS: slack://xoxp-1234-1234-1234-4ddbc191d40ee098cbaae6f3523ada2d # (2)!
```

1. Dolce relies on the external Apprise container to send notifications to Slack. This is only the simplest example.
2. See [the documentation](https://github.com/caronc/apprise/wiki/Notify_slack) for a full overview on how you can
   customize the notifications

Also see the page on [Apprise Notifications](./apprise.md) for more information.
