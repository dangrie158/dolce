## Docker Live Container Events

![Dolce logo](https://github.com/dangrie158/dolce/blob/master/assets/logo_full.svg)

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

## Setup

Add the dolce service to your `docker-compose.yml`. Example:

```yaml
services:
  importatntservice:
    image: "ubuntu:latest"
    command: "sleep 1; exit 0;"
    restart: unless-stopped
  dolce:
    image: dangrie158/dolce:v2.1.1
    volumes: # we need access to the docker socket inside the container
      - /var/run/docker.sock:/var/run/docker.sock
    environment: # or use a .env file
        # get notified via EMail
        SMTP_HOSTNAME: smtp.gmail.com # see below for how to configure using your gmail
        SMTP_RECIPIENTS: incidents@example.com:personal@gmail.com

        # get notified via discord
        DISCORD_WEBHOOK: https://ptb.discord.com/api/webhooks/<YOUR_WEBHOOK>

        # get notified via Telegram messages
        TELEGRAM_HTTP_TOKEN: 123456789123456:AABBCCDDEEFFGGHHIIJJKKLLMM
        TELEGRAM_RECIPIENT_IDS: 12345678912:456789123 # see below for how to get these values
    restart: unless-stopped # Dolce handles restarts gracefully and tries to recover any messages that may happened while the service was down
```

## Configuration

Configuration of the service is done via environment variables.

### General Behaviour:

- `DOLCE_LOG_LEVEL: string?` one of the [Deno Log Levels](https://deno.land/std@0.202.0/log/mod.ts?s=LogLevels),
  defaults to `INFO`
- `DOCKER_HOST: string?` path to the docker socket, defaults to `/var/run/docker.sock`, can be set to an `ip:port`-pair
  when used with `DOCKER_TRANSPORT=tcp`
- `DOCKER_TRANSPORT: string?` must be either `unix` or `tcp`, defaults to `unix`
- `DOLCE_SUPERVISION_MODE: string?` if set to the string `TAGGED`, only containers with the tag `dolce.enabled` and a
  value of true will create events, defaults to all in which case all containers are supervised. Example:
  ```yaml
  services:
  importatntservice:
    ...# will create notifications
    tags:
      dolce.enabled: true
  unimportatntservice:
    ...# won't create notifications
    tags:
      dolce.enabled: false
  anotherunimportantservice:
    ...# won't create notifications
  dolce:
    image: dangrie158/dolce
    ...
    environment:
      DOLCE_SUPERVISION_MODE: TAGGED
  ```

### Notification Backoff

- `DOLCE_MIN_TIMEOUT: number`: minimum number of seconds between notifications, defaults to $m=10$
- `DOLCE_MAX_TIMEOUT: number`: maximum number of seconds between notifications, defaults to $M=60 * 60 * 24$ (1 day)
- `DOLCE_MULTIPLIER: number`: multiplier to increase the timeout with each message, defaults to $f=10$

The delay between notifications is calculated as $delay(n) = min(m * f ^ n, M)$ where $n$ is the current iteration of
the backoff algorithm.

If you assume you have a container that has a problem and repeatetly restarts every second starting $t=0$, you will
receive the following notifications with the default settings

| $n$ |        $delay$ |        |             $t$ | $t_n = t_(n-1) + delay$ |
| --- | -------------: | ------ | --------------: | ----------------------- |
| 1   |  $10 * 10 ^ 0$ | 10     |     $0 + delay$ | 10                      |
| 2   |  $10 * 10 ^ 1$ | 100    |    $10 + delay$ | 110                     |
| 3   |  $10 * 10 ^ 2$ | 1_000  |   $110 + delay$ | 1110                    |
| 4   |  $10 * 10 ^ 3$ | 10_000 |  $1110 + delay$ | 11110                   |
| 5   | $60 * 60 * 24$ | 86_400 | $11110 + delay$ | 97510                   |
| 6   | $60 * 60 * 24$ | 86_400 | $97510 + delay$ | 97510                   |

From this moment nothing changes anymore and you will receive a new message every 24h. $n$ wil be reset if the delay for
the next notification passes and no events happen that would require a new notification. This means: if you fix the
problem and everything is quiet for the next 24 hours and breaks again after that time, you will be notified within
`DOLCE_MIN_TIMEOUT` seconds again.

### Setup SMTP Notifications:

#### Available Settings:

- `SMTP_HOSTNAME: string` required, fqdn or ip of the sending mailserver
- `SMTP_RECIPIENTS: string[]` required, a colon (`:`) separated list of recipient adresses
- `SMTP_PORT: number?` optional, uses default ports depending on `SMTP_USETLS`
- `SMTP_USERNAME: string?` optional, no authentication is used if unset
- `SMTP_PASSWORD: string?` optional, no authentication is used if unset
- `SMTP_USETLS: boolean?` optional, defaults to false
- `SMTP_FROM: string?` optional, defaults to dolce@<hostname>

### Setup GMail as your SMTP Server

If you don't have a SMTP Server handy that you can use to send your notifications, using the GMail SMTP server may be a
handy alternative for small setups. For this you need to setup the service as follows:

```yaml
- SMTP_HOSTNAME: smtp.gmail.com
- SMTP_RECIPIENTS: incidents@service.com
- SMTP_USETLS: 1
- SMTP_USERNAME: <youraccount>@gmail.com
- SMTP_PASSWORD: <Your App Password>
- SMTP_FROM: <youraccount>@service.com
```

Your can find a [Tutorial here](https://support.google.com/accounts/answer/185833?hl=en) on how to get the
`<App Password>`

### Setup Discord Notifications:

#### Required Settings:

- `DISCORD_WEBHOOK: string` URL of the webhook (required to enable the notifier)

#### Step by Step:

- Open Discord
- Go to the channel you want to get the updates
- Click the settings icon
- Go to `Integrations` -> `Webhooks`
- Create a `New Webhook`, set it up however you want. you can use the png icon in `assets/` as a profile picture if you
  want or choose whatever you want
- `Copy Webhook URL` to get the URL into your Clipboard

### Setup Telegram Notifications:

#### Required Settings:

- `TELEGRAM_HTTP_TOKEN: string`
- `TELEGRAM_RECIPIENT_IDS: string[]` colon separated list of chat IDs

#### Step by Step:

- Message [@BotFather](https://t.me/thebotfather) to create a new Bot and get your `TELEGRAM_HTTP_TOKEN`
- Add the Bot to the Group you want to recieve updates in or send a DM from your account
- go to `https://api.telegram.org/bot<TELEGRAM_HTTP_TOKEN>/getUpdates` or use
  `curl https://api.telegram.org/bot<TELEGRAM_HTTP_TOKEN>/getUpdates | jq '.result[].message.from'` if you have `curl`
  and `jq` installed`
- get the IDs your interested in from the response
