---
title: SMTP / Email
icon: material/email
---

# Setup SMTP / Email Notifications

## Available Settings:

You can configure email notifications via SMTP using the following environment variables

| Name              | Type       |      Default       | Description                                                                              |
| ----------------- | ---------- | :----------------: | ---------------------------------------------------------------------------------------- |
| `SMTP_HOSTNAME`   | `string`   |  :material-null:   | FQDN or IP of the Sending Mailserver                                                     |
| `SMTP_RECIPIENTS` | `string[]` |  :material-null:   | A comma-separated list of recipient adresses                                             |
| `SMTP_PORT`       | `number?`  |  `25 / 465 / 587`  | Uses default ports depending on `SMTP_USETLS` and `SMTP_USERNAME`                        |
| `SMTP_USERNAME`   | `string?`  |  :material-null:   | No authentication is used if unset                                                       |
| `SMTP_PASSWORD`   | `string?`  |  :material-null:   | No authentication is used if unset                                                       |
| `SMTP_USETLS`     | `boolean?` |       false        | See [Use implicit TLS](#use-implicit-tls) and [Use STARTTLS](#use-starttls-explicit-tls) |
| `SMTP_FROM`       | `string?`  | `dolce@<hostname>` | Supports mailbox format as specified in RFC 5322 (see [Example](#example))               |

## Example

```yaml
services:
    dolce:
        image: dangrie158/dolce:v4.0.1
        restart: unless-stopped
        volumes:
            - /var/run/docker.sock:/var/run/docker.sock
        environment:
            SMTP_HOSTNAME: smtp.example.com
            SMTP_USETLS: 1
            # SMTP_PORT: 465 # (1)
            SMTP_RECIPIENTS: incidents@example.com,ondutyguy@gmail.com
            # SMTP_USERNAME: # (2)
            # SMTP_PASSWORD:
            SMTP_FROM: "Dolce Container Monitor <dolce@example.com>"
```

1. set automatically because of `SMTP_USETLS`
2. If unset wont authenticate to the mailserver

## Use implicit TLS

If you want to use an implicit TLS connection to your SMTP server, you can set the `SMTP_USETLS` variable and set
`SMTP_USERNAME` and `SMTP_PASSWORD` variables.

`SMTP_PORT` will default to `465`.

## Use STARTTLS / explicit TLS

If you want to use an explicit TLS connection using the `STARTTLS` command, you can leave `SMTP_USETLS` unset and set
the `SMTP_USERNAME` and `SMTP_PASSWORD` variables.

`SMTP_PORT` will default to `587` in this case.

## Setup GMail as your SMTP Server

If you don't have a SMTP Server handy that you can use to send your notifications, using the GMail SMTP server may be a
handy alternative for small setups. For this you need to setup the service as follows:

```yaml
SMTP_HOSTNAME: smtp.gmail.com
SMTP_RECIPIENTS: incidents@service.com
SMTP_USETLS: 1
SMTP_USERNAME: <youraccount>@gmail.com
SMTP_PASSWORD: <Your App Password>
SMTP_FROM: <youraccount>@service.com
```

Your can find a [Tutorial here](https://support.google.com/accounts/answer/185833?hl=en) on how to get the
`<App Password>`
