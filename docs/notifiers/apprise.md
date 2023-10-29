---
title: other w/ Apprise
icon: octicons/megaphone-24
---

# Setup other Notifications

While the build-in notifiers are all tailored to a rich experience that uses the available features of the platform, it
is impossible to support all available notification services.

For this reason, Dolce supports [Apprise](https://github.com/caronc/apprise) to cover
[loads of notification services](https://github.com/caronc/apprise#supported-notifications).

To avoid having to bundle Apprise into the Docker containers, Dolce relies on the
[Apprise API](https://github.com/caronc/apprise-api) that can simply be hosten in another docker container.

## Available Settings:

You can configure chat notifications using the following environment variables

| Name               | Type                                          | Default         | Description                           |
| ------------------ | --------------------------------------------- | --------------- | ------------------------------------- |
| `APPRISE_HOST`     | `string`                                      | :material-null: | Host where the Apprise API is running |
| `APPRISE_PROTOCOL` | `http` \| `https`                             | `http`          | Protocol to connect tp the host       |
| `APPRISE_URLS`     | `string`                                      | :material-null: | space separated list of Apprise URLs  |
| `APPRISE_TAG`      | `string`                                      | :material-null: | tag that receives the notifications   |
| `APPRISE_TYPE`     | `info` \| `success` \| `warning` \| `failure` | `info`          | Type of the notification              |

## Example

```yaml
version: "3"
services:
  apprise: # (1)!
    image: caronc/apprise:latest

  dolce:
    image: dangrie158/dolce:v2.8.0
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      APPRISE_HOST: apprise:8000 # (2)!
      APPRISE_URLS: >- # (3)!
        mmost://localhost:8065/yokkutpah3r3urc5h6i969yima
        slack://xoxp-1234-1234-1234-4ddbc191d40ee098cbaae6f3523ada2d
```

1. This is the simplest configuration to get the Apprise service running. See
   [the Apprise API documentation](https://github.com/caronc/apprise-api) for more involved examples.
2. We reference the containername from before
3. Use [YAML multi-line strings](https://yaml-multiline.info) to get a space separated string but keep the docker
   compose file readable. In the linux kernel the maximum size for any environment variable is
   [128KB](https://askubuntu.com/questions/1385551/how-long-can-display-environment-variable-value-be#:~:text=As%20a%20result%2C%20the%20maximum,or%20any%20other%2C%20is%20128KB.)
   so this should be enough for most applications. Otherwise you can use
   [tags :material-tag:](https://github.com/caronc/apprise-api#persistent-storage-solution) in a mounted Apprise
   configuration.

See [this page](https://github.com/caronc/apprise/wiki#notification-services) for a full list of available notifiers.
