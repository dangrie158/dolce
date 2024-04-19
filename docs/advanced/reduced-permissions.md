---
title: Reduced Permissions
icon: material/shield-key
---

# Run using Reduced Permissions

By default you need to mount the docker socket with read **and write** permissions. Any container with this level of
access effecively has root-priviledges on the host.

Sadly you can't simply mount the docker socket read-only. Although dolce never changes anything that would require write
access to the docker API (e.g. creating mounts), it needs write access to send HTTP requests to the it.

If you don't trust the prebuild images and want to err on the safe side, you can reduce the attack area by using
[docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy) and connect dolce to this proxy via TCP. This
means you only need to trust the

> official Alpine-based HAProxy image with a small configuration file

which you can also use to hook up other services. Here is a sample configuration file to get you started:

```yaml
version: "3"
services:
  dolce:
    image: dangrie158/dolce:v2.10.7
    restart: unless-stopped
    environment:
      DOCKER_HOST: docker-proxy:2375 # (1)!
      DOCKER_TRANSPORT: tcp

  docker-proxy:
    image: tecnativa/docker-socket-proxy
    environment:
      INFO: 1 # (2)!
    ports:
      - 127.0.0.1:2375:2375
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```

1. references the name of the `docker-socket-proxy` container below
2. needed to get the hostname in some templates

Notice how you don't need to mount the docker socket in the `dolce` container, but only in the `docker-proxy` which
allows `dolce` read-only access to a small part of the API by default.
