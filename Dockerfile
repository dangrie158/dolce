FROM denoland/deno:alpine
ENV DOCKER_HOST /var/run/docker.sock

WORKDIR /dolce

# Cache the dependencies as a layer
COPY deps.ts .
RUN deno cache deps.ts

COPY . .

RUN mkdir -p /var/run/dolce
# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache main.ts

CMD exec deno run \
# unstable flag is needed for Deno.connect to a Unix Socket (lib/universal-http.ts)
    --unstable \
# /var/run/dolce/ => lockfile directory
    --allow-read="./templates,/var/run/dolce/,${DOCKER_HOST}" \
# /var/run/dolce/ => lockfile directory
    --allow-write="/var/run/dolce/,${DOCKER_HOST}" \
# for SmtpNotifier
    --allow-net="discord.com,api.telegram.org,${SMTP_HOSTNAME:-localhost},${DOCKER_HOST}" \
# for lib/env.ts, obviously
    --allow-env \
# for Deno.kill in lib/lockfile.ts
    --allow-run \
    main.ts
