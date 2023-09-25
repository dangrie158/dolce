FROM denoland/deno:alpine
ENV DOCKER_SOCKET /var/run/docker.sock

WORKDIR /dolce

# Cache the dependencies as a layer
COPY deps.ts .
RUN deno cache deps.ts

COPY . .

RUN mkdir -p /var/run/dolce
# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache main.ts

CMD exec deno run \
# unstable flag is needed for Deno.connect to a Unix Socket (lib/uds-http.ts)
    --unstable \
# /var/run/dolce/ => lockfile directory
    --allow-read="./templates,/var/run/dolce/,${DOCKER_SOCKET}" \
# /var/run/dolce/ => lockfile directory
    --allow-write="/var/run/dolce/,${DOCKER_SOCKET}" \
# for SmtpNotifier
    --allow-net="discord.com,api.telegram.org,${SMTP_HOSTNAME:-localhost}" \
# for lib/env.ts, obviously
    --allow-env \
# for Deno.kill in lib/lockfile.ts
    --allow-run \
    main.ts
