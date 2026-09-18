# GENERATED from pack b1cc21aac85c69e360d04e0d9c7e46a7d6cb94619d0ada5b7ea00e95c1bd7186; do not edit
ARG PACK_HASH
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV PACK_HASH=$PACK_HASH
RUN corepack enable
RUN corepack prepare pnpm@11.24.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps
COPY content/out/pack.json /app/pack.json
RUN pnpm install --frozen-lockfile
RUN pnpm exec tsc -b
FROM node:24-bookworm-slim
ARG PACK_HASH
ENV PACK_HASH=$PACK_HASH
ENV PACK_PATH=/app/pack.json
ENV CORPORATOR_LISTEN_PORT=7460
ENV CORPORATOR_LISTEN_BIND=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/pack.json /app/pack.json
COPY --from=build --chown=node:node /app/services/api/dist ./services/api/dist
COPY --from=build --chown=node:node /app/services/attestor/dist ./services/attestor/dist
COPY --from=build --chown=node:node /app/services/buyback/dist ./services/buyback/dist
COPY --from=build --chown=node:node /app/services/llm/dist ./services/llm/dist
COPY --from=build --chown=node:node /app/services/sampler/dist ./services/sampler/dist
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/services/api/migrations ./services/api/migrations
USER node
EXPOSE 7460
EXPOSE 7463
EXPOSE 7462
EXPOSE 7464
EXPOSE 7461
CMD ["node", "services/api/dist/main.js"]
