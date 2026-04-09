# Dashboard Admin

Dashboard admin berbasis Next.js untuk memantau data Telkomsel Poin Merchant, operasional, dan proses ingestion CSV.

## Stack

- Next.js App Router
- React 19
- Tailwind CSS v4
- Drizzle ORM
- PostgreSQL

## Fitur

- Dashboard overview
- Dashboard operational
- Panel ingestion CSV
- Login admin dengan session berbasis cookie `httpOnly`
- Seed admin awal lewat script

## Setup

1. Install dependency:

```bash
pnpm install
```

2. Buat file `.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DB_NAME
NEXT_PUBLIC_INGESTION_API_URL=http://localhost:8001
```

3. Jalankan migrasi database:

```bash
pnpm db:migrate
```

4. Seed akun admin pertama:

```bash
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD=changeme123 \
ADMIN_NAME="Admin Dashboard" \
pnpm db:seed-admin
```

5. Jalankan aplikasi:

```bash
pnpm dev
```

App default berjalan di `http://localhost:3000`.

## Login

Setelah seed berhasil, buka:

- `http://localhost:3000/login`

Gunakan email dan password admin yang dibuat saat menjalankan `db:seed-admin`.

## Scripts

- `pnpm dev` menjalankan development server
- `pnpm build` build production
- `pnpm start` menjalankan hasil build
- `pnpm lint` menjalankan ESLint
- `pnpm db:generate` generate perubahan schema Drizzle
- `pnpm db:migrate` menjalankan migration
- `pnpm db:push` push schema langsung ke database
- `pnpm db:push:force` push schema dengan force
- `pnpm db:studio` buka Drizzle Studio
- `pnpm db:seed-admin` membuat atau update akun admin

## Struktur Singkat

- [`src/app`](/home/ayasy/Documents/Magang/Projek/dashboard_admin/src/app) route App Router
- [`src/lib/db`](/home/ayasy/Documents/Magang/Projek/dashboard_admin/src/lib/db) koneksi dan schema database
- [`src/lib/auth.ts`](/home/ayasy/Documents/Magang/Projek/dashboard_admin/src/lib/auth.ts) logic autentikasi dan session
- [`src/features`](/home/ayasy/Documents/Magang/Projek/dashboard_admin/src/features) fitur dashboard per domain
- [`src/lib/db/migration`](/home/ayasy/Documents/Magang/Projek/dashboard_admin/src/lib/db/migration) migration SQL
- [`ingestion_service`](/home/ayasy/Documents/Magang/Projek/dashboard_admin/ingestion_service) service ingestion terpisah (python)

## Catatan

- Route dashboard utama dilindungi middleware dan verifikasi session server-side.
- Server ingestion perlu berjalan terpisah jika fitur upload/monitor batch ingin dipakai.
- Jangan commit kredensial database atau admin ke repository.
