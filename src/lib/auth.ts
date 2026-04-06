import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { adminSessions, adminUsers } from "@/lib/db/schema";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

const scrypt = promisify(nodeScrypt);

const DEFAULT_SESSION_DAYS = 1;
const REMEMBERED_SESSION_DAYS = 30;

export type AuthenticatedAdmin = {
  id: string;
  email: string;
  fullName: string;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const createSessionToken = () => randomBytes(32).toString("base64url");

const hashSessionToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const toExpiryDate = (remember: boolean) => {
  const days = remember ? REMEMBERED_SESSION_DAYS : DEFAULT_SESSION_DAYS;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

const safeRedirectPath = (value: string | null | undefined) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  if (value.startsWith("/login")) {
    return "/";
  }

  return value;
};

const getRequestMetadata = async () => {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");

  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() || null,
    userAgent: headerStore.get("user-agent"),
  };
};

const clearSessionCookie = async () => {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
};

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function authenticateAdmin(input: {
  email: string;
  password: string;
  remember: boolean;
}) {
  const email = normalizeEmail(input.email);
  const [user] = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      fullName: adminUsers.fullName,
      passwordHash: adminUsers.passwordHash,
      isActive: adminUsers.isActive,
    })
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (!user || !user.isActive) {
    return null;
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    return null;
  }

  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = toExpiryDate(input.remember);
  const metadata = await getRequestMetadata();

  await db.insert(adminSessions).values({
    userId: user.id,
    sessionTokenHash: tokenHash,
    expiresAt: expiresAt.toISOString(),
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  await setSessionCookie(token, expiresAt);

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
  } satisfies AuthenticatedAdmin;
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await db
      .delete(adminSessions)
      .where(eq(adminSessions.sessionTokenHash, hashSessionToken(token)));
  }

  await clearSessionCookie();
}

export async function getCurrentAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const now = new Date().toISOString();

  const [session] = await db
    .select({
      sessionId: adminSessions.id,
      userId: adminUsers.id,
      email: adminUsers.email,
      fullName: adminUsers.fullName,
      isActive: adminUsers.isActive,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.sessionTokenHash, tokenHash),
        gt(adminSessions.expiresAt, now)
      )
    )
    .limit(1);

  if (!session || !session.isActive) {
    await clearSessionCookie();
    return null;
  }

  await db
    .update(adminSessions)
    .set({ lastUsedAt: now })
    .where(eq(adminSessions.id, session.sessionId));

  return {
    id: session.userId,
    email: session.email,
    fullName: session.fullName,
  } satisfies AuthenticatedAdmin;
}

export async function requireAdminUser(nextPath = "/") {
  const user = await getCurrentAdminUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(safeRedirectPath(nextPath))}`);
  }
  return user;
}

export function getSafeRedirectPath(value: string | null | undefined) {
  return safeRedirectPath(value);
}
