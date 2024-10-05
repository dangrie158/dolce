FROM denoland/deno:1.46.3

ENV DOLCE_CUSTOM_TEMPLATE_PATH /var/dolce-custom-templates/

WORKDIR /dolce

COPY . .

RUN mkdir -p /var/run/dolce
# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache main.ts lib/*.ts

ENTRYPOINT []
CMD deno run \
# flag is needed for Deno.connect to a Unix Socket (lib/universal-http.ts)
    --unstable-http \
# flag is needed for unstable KV storage
    --unstable-kv \
# flag is needed for unstable Cron
    --unstable-cron \
# flag is needed for unstable Temporal API used in lib/chrono.ts and for blackout windows
    --unstable-temporal \
    --allow-read="./templates,${DOLCE_RUN_DIRECTORY:-/var/run/dolce/},${DOCKER_HOST:-/var/run/docker.sock},${DOLCE_CUSTOM_TEMPLATE_PATH}" \
    --allow-write="${DOLCE_RUN_DIRECTORY:-/var/run/dolce/},${DOCKER_HOST:-/var/run/docker.sock}" \
# for SmtpNotifier
    --allow-net="discord.com,api.telegram.org,${SMTP_HOSTNAME:-localhost},${APPRISE_HOST:-localhost}$( [ x${DOCKER_TRANSPORT:-unix} != 'xunix' ] && echo ,$DOCKER_HOST )" \
# for lib/env.ts, obviously
    --allow-env \
# for Deno.kill in lib/lockfile.ts
    --allow-run \
    main.ts
