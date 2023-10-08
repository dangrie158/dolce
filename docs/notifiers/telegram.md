---
title: Telegram
icon: simple/telegram
---

# Setup Telegram Chat Notifications

## Available Settings:

You can configure chat notifications using the following environment variables

| Name                     | Type       | Default         | Description                      |
| ------------------------ | ---------- | --------------- | -------------------------------- |
| `TELEGRAM_HTTP_TOKEN`    | `string`   | :material-null: | API token of the bot user        |
| `TELEGRAM_RECIPIENT_IDS` | `string[]` | :material-null: | Colon-separated list of chat IDs |

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
      TELEGRAM_HTTP_TOKEN: 123456789123456:AABBCCDDEEFFGGHHIIJJKKLLMM
      TELEGRAM_RECIPIENT_IDS: 12345678912:456789123
```

## Step by Step:

1. Message [@BotFather](https://t.me/thebotfather) to create a new Bot and get your `TELEGRAM_HTTP_TOKEN`
2. Add the Bot to the Group you want to recieve updates in or send a DM from your account
3. go to `https://api.telegram.org/bot<TELEGRAM_HTTP_TOKEN>/getUpdates` or use
   `curl https://api.telegram.org/bot<TELEGRAM_HTTP_TOKEN>/getUpdates | jq '.result[].message.from'` if you have `curl`
   and `jq` installed`
4. get the IDs your interested in from the response
