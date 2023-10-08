---
title: Discord
icon: simple/discord
---

# Setup Discord Chat Notifications

## Available Settings:

You can configure chat notifications via discord using the following environment variables

| Name              | Type     | Default         | Description        |
| ----------------- | -------- | --------------- | ------------------ |
| `DISCORD_WEBHOOK` | `string` | :material-null: | URL of the webhook |

## Example

```yaml
version: "3"
services:
  dolce:
    image: dangrie158/dolce:v2.5.2
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      DISCORD_WEBHOOK:  https://discord.com/api/webhooks/<YOUR_WEBHOOK>
```

## Step by Step:

1. Open Discord
2. Go to the channel you want to get the updates
3. Click the settings icon
4. Go to `Integrations` -> `Webhooks`
5. Create a `New Webhook`, set it up however you want. you can use the png icon in `docs/assets/` as a profile picture
   if you want or choose whatever you want
6. `Copy Webhook URL` to get the URL into your Clipboard
