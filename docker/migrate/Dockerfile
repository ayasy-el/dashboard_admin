FROM node:20-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY drizzle.config.ts tsconfig.json ./
COPY src/lib/db ./src/lib/db
COPY src/lib/db/migration ./src/lib/db/migration
COPY .pnpm-store /pnpm-store

RUN pnpm config set store-dir /pnpm-store && pnpm install --offline --frozen-lockfile

COPY docker/migrate/entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["pnpm", "exec", "drizzle-kit", "migrate"]
