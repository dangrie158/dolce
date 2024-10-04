---
title: Mattermost
icon: simple/mattermost
---

# Mattermost Notifications

Mattermost is currently supported through [Apprise](./apprise.md). See
[the documentation](https://github.com/caronc/apprise/wiki/Notify_mattermost) for all posible options.

An example configuration is:

```yaml
services:
  apprise: # (1)!
    image: caronc/apprise:latest

  dolce:
    image: dangrie158/dolce:v3.1.0
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      APPRISE_HOST: apprise:8000
      APPRISE_URLS: mmosts://mattermost.server.local/3ccdd113474722377935511fc85d3dd4 # (2)!
```

1. Dolce relies on the external Apprise container to send notifications to Mattermost. This is only the simplest
   example.
2. See [the documentation](https://github.com/caronc/apprise/wiki/Notify_mattermost) for a full overview on how you can
   customize the notifications

Also see the page on [Apprise Notifications](./apprise.md) for more information.
