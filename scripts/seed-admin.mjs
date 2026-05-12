import { randomBytes, scryptSync } from "node:crypto";
import readline from "node:readline";
import process from "node:process";

import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function ask(question) {
    return new Promise((resolve) => {
      rl.question(question, resolve);
    });
  }

  async function askSecret(question) {
    if (!process.stdin.isTTY) {
      throw new Error("Password prompt requires an interactive terminal");
    }

    return new Promise((resolve) => {
      const stdin = process.stdin;
      const stdout = process.stdout;

      stdout.write(question);
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding("utf8");

      let value = "";

      function cleanup() {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
      }

      function onData(char) {
        const key = char.toString();

        if (key === "\r" || key === "\n") {
          cleanup();
          resolve(value);
          return;
        }

        if (key === "\u0003") {
          cleanup();
          process.exit(130);
        }

        if (key === "\u007f" || key === "\b") {
          value = value.slice(0, -1);
          return;
        }

        value += key;
      }

      stdin.on("data", onData);
    });
  }

  return { rl, ask, askSecret };
}

const { rl, ask, askSecret } = createPrompt();

try {
  const email = (await ask("Admin email: ")).trim().toLowerCase();
  if (!email) {
    throw new Error("Admin email is required");
  }

  const fullNameInput = (await ask("Full name [Admin Dashboard]: ")).trim();
  const fullName = fullNameInput || "Admin Dashboard";

  const password = await askSecret("Password: ");
  if (!password) {
    throw new Error("Password is required");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const confirmPassword = await askSecret("Confirm password: ");
  if (password !== confirmPassword) {
    throw new Error("Password confirmation does not match");
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
} finally {
  rl.close();
}
