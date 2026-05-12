# Dashboard Admin

Next.js admin dashboard for monitoring Telkomsel Poin Merchant data, operations, and CSV ingestion workflows.

## Stack

- Next.js App Router
- React 19
- Tailwind CSS v4
- Drizzle ORM
- PostgreSQL

## Features

- Dashboard overview
- Operational dashboard
- CSV ingestion panel
- Admin login with `httpOnly` cookie sessions
- Database-backed merchant promo banner management
- Banner image uploads stored outside `public` through a protected asset route
- Admin bootstrap via script

## Local Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DB_NAME
NEXT_PUBLIC_INGESTION_API_URL=http://localhost:8001
ADMIN_ASSET_SHARED_SECRET=replace-with-random-long-secret
```

3. Run database migrations:

```bash
pnpm db:migrate
```

4. Seed the first admin account:

```bash
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD=changeme123 \
ADMIN_NAME="Admin Dashboard" \
pnpm db:seed-admin
```

5. Start the app:

```bash
pnpm dev
```

The app runs at `http://localhost:3000`.

## Docker Setup

Use `../docker-compose.yaml` from the root workspace.

Docker files used by this app:

- [`docker/Dockerfile`](./docker/Dockerfile)
- [`docker/ingestion_service/Dockerfile`](./docker/ingestion_service/Dockerfile)
- [`docker/postgres/Dockerfile`](./docker/postgres/Dockerfile)

Runtime secrets are read from `/.secrets/` at the root of the project:

- `postgres_user`
- `postgres_db`
- `postgres_password`
- `database_url`
- `auth_session_secret`
- `admin_asset_shared_secret`

Example secret layout:

```text
.secrets/
  postgres_user
  postgres_db
  postgres_password
  database_url
  auth_session_secret
  admin_asset_shared_secret
```

### Docker Commands

Run from the root workspace `../`:

```bash
docker compose -f docker-compose.yaml up --build
docker compose -f docker-compose.yaml up --build dashboard-admin
docker compose -f docker-compose.yaml up --build dashboard-merchant
docker compose -f docker-compose.yaml run --rm schema-migrate
docker compose -f docker-compose.yaml down
docker compose -f docker-compose.yaml logs -f
```

If Postgres was started before and the data directory is dirty, reset the volume first:

```bash
docker compose -f docker-compose.yaml down -v
```

If you need to build a specific image directly:

```bash
docker build -f docker/Dockerfile .
docker build -f docker/ingestion_service/Dockerfile .
```

The `schema-migrate` service runs automatically before the apps start, so the database schema is applied before `admin_users` or other tables are queried.

## Login

After seeding succeeds, open:

- `http://localhost:3000/login`

Use the admin email and password created by `db:seed-admin`.

## Scripts

- `pnpm dev` starts the development server
- `pnpm build` builds production assets
- `pnpm start` runs the production build
- `pnpm lint` runs ESLint
- `pnpm db:generate` generates Drizzle schema changes
- `pnpm db:migrate` runs migrations
- `pnpm db:push` pushes the schema directly to the database
- `pnpm db:push:force` pushes the schema with force
- `pnpm db:studio` opens Drizzle Studio
- `pnpm db:seed-admin` creates or updates the admin account

## Project Structure

- [`src/app`](./src/app) App Router routes
- [`src/lib/db`](./src/lib/db) database connection and schema
- [`src/lib/auth.ts`](./src/lib/auth.ts) authentication and session logic
- [`src/features`](./src/features) feature modules by domain
- [`src/lib/db/migration`](./src/lib/db/migration) SQL migrations
- [`ingestion_service`](./ingestion_service) separate ingestion service in Python
- [`docker`](./docker) Dockerfiles, entrypoints, and runtime helpers

## Notes

- The main dashboard route is protected by middleware and server-side session checks.
- The ingestion server must run separately if you want CSV upload and batch monitoring.
- The app Dockerfile is in [`docker/Dockerfile`](./docker/Dockerfile) and the ingestion Dockerfile is in [`docker/ingestion_service/Dockerfile`](./docker/ingestion_service/Dockerfile).
- Public merchant-facing endpoints:
  - Protected asset route: `GET /api/admin/banner-assets/:key`, accepts an admin session or a valid signed URL
  - `GET /api/banners` returns active banners ordered by `sort_order` and filtered by schedule window
  - `GET /api/program-banner-assets` returns active program assets if used by the merchant
- Admin banner endpoints:
  - `GET /api/admin/banners`
  - `POST /api/admin/banners`
  - `PATCH /api/admin/banners/:id`
  - `DELETE /api/admin/banners/:id`
- Admin program asset endpoints:
  - `GET /api/admin/program-banner-assets`
  - `POST /api/admin/program-banner-assets`
  - `PATCH /api/admin/program-banner-assets/:id`
  - `DELETE /api/admin/program-banner-assets/:id`
- Do not commit database or admin credentials to the repository.
