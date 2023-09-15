FROM denoland/deno:alpine
ENV DOCKER_SOCKET /var/run/docker.sock

WORKDIR /dolce

# Cache the dependencies as a layer
COPY deps.ts .
RUN deno cache module.ts

COPY . .
# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache main.ts

CMD exec deno run --unstable --allow-write=${DOCKER_SOCKET} --allow-read=${DOCKER_SOCKET} --watch main.ts
