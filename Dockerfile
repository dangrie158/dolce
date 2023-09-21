FROM denoland/deno:alpine
ENV DOCKER_SOCKET /var/run/docker.sock

WORKDIR /dolce

# Cache the dependencies as a layer
COPY deps.ts .
RUN deno cache deps.ts

COPY . .
# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache main.ts

CMD exec deno run \
    --unstable \
    --allow-read=${DOCKER_SOCKET},./templates \
    --allow-write=${DOCKER_SOCKET} \
    --allow-net ${SMTP_HOSTNAME} \
    --allow-env \
    main.ts
