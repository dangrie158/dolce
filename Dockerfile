FROM denoland/deno:latest

ENV DOLCE_CUSTOM_TEMPLATE_PATH /var/dolce-custom-templates/

WORKDIR /dolce

# Cache the dependencies as a layer
COPY deps.ts .
RUN /bin/deno cache deps.ts

COPY . .

RUN mkdir -p /var/run/dolce
# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache main.ts

ENTRYPOINT []
CMD deno run \
# flag is needed for Deno.connect to a Unix Socket (lib/universal-http.ts)
    --unstable-http \
# flag is needed for unstable KV storage
    --unstable-kv \
# flag is needed for unstable Cron
    --unstable-cron \
# /var/run/dolce/ => lockfile directory
    --allow-read="./templates,/var/run/dolce/,${DOCKER_HOST:-/var/run/docker.sock},${DOLCE_CUSTOM_TEMPLATE_PATH}" \
# /var/run/dolce/ => lockfile directory
    --allow-write="/var/run/dolce/,${DOCKER_HOST:-/var/run/docker.sock}" \
# for SmtpNotifier
    --allow-net="discord.com,api.telegram.org,${SMTP_HOSTNAME:-localhost},${APPRISE_HOST:-localhost},${DOCKER_HOST:-localhost}" \
# for lib/env.ts, obviously
    --allow-env \
# for Deno.kill in lib/lockfile.ts
    --allow-run \
    main.ts
