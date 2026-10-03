# GENERATED from pack 1053fda2283e116cf4706ae3910b046f3a66594e8bf4bffc958e52a53b8d4bd8; do not edit
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
COPY content ./content
COPY art ./art
COPY assets ./assets
COPY hud ./hud
COPY content/out/pack.json /app/pack.json
RUN pnpm install --frozen-lockfile
RUN pnpm exec tsc -b
RUN pnpm exec tsc -p services/web/tsconfig.json
RUN pnpm --filter @corporator/client build
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
COPY --from=build --chown=node:node /app/services/sampler/dist ./services/sampler/dist
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/services/api/migrations ./services/api/migrations
COPY --from=build --chown=node:node /app/services/web/dist ./services/web/dist
COPY --from=build --chown=node:node /app/apps/client/dist-web ./client
USER node
EXPOSE 7460
EXPOSE 7463
EXPOSE 7462
EXPOSE 7461
EXPOSE 7464
CMD ["node", "services/api/dist/main.js"]
