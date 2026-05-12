FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY next.config.ts tsconfig.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY components.json drizzle.config.ts eslint.config.mjs postcss.config.mjs next-env.d.ts ./
COPY .pnpm-store /pnpm-store
RUN pnpm config set store-dir /pnpm-store && pnpm install --offline --frozen-lockfile

FROM base AS builder
WORKDIR /app
ARG DATABASE_URL=postgresql://placeholder:placeholder@127.0.0.1:5432/postgres
ENV DATABASE_URL=$DATABASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY docker/entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
