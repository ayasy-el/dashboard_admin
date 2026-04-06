import { randomBytes, scryptSync } from "node:crypto";
import process from "node:process";

import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_NAME?.trim() || "Admin Dashboard";

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

if (!email || !password) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
}

if (password.length < 8) {
  throw new Error("ADMIN_PASSWORD must be at least 8 characters");
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
const passwordHash = `${salt}:${hash}`;

const pool = new Pool({ connectionString });

try {
  await pool.query(
    `
      insert into admin_users (email, full_name, password_hash, is_active)
      values ($1, $2, $3, true)
      on conflict (email)
      do update set
        full_name = excluded.full_name,
        password_hash = excluded.password_hash,
        is_active = true,
        updated_at = now()
    `,
    [email, fullName, passwordHash]
  );

  console.log(`Admin user seeded: ${email}`);
} finally {
  await pool.end();
}
