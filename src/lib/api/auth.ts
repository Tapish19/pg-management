import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const COOKIE_NAME = "pg_session";

export type SessionPayload = {
  ownerId: string;
  email: string;
  name: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(payload: SessionPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function setSessionCookie(token: string) {
  setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export function clearSessionCookie() {
  deleteCookie(COOKIE_NAME, { path: "/" });
}

export function getSession(): SessionPayload | null {
  const token = getCookie(COOKIE_NAME);
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

// ---------- Tenant (resident) sessions — separate cookie, no password ----------
// Tenants sign in with the email + phone that matches an existing booking.

const TENANT_COOKIE_NAME = "pg_tenant_session";

export type TenantSessionPayload = {
  tenantId: string;
  name: string;
  email: string;
};

export function createTenantSessionToken(payload: TenantSessionPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function setTenantSessionCookie(token: string) {
  setCookie(TENANT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export function clearTenantSessionCookie() {
  deleteCookie(TENANT_COOKIE_NAME, { path: "/" });
}

export function getTenantSession(): TenantSessionPayload | null {
  const token = getCookie(TENANT_COOKIE_NAME);
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as TenantSessionPayload;
  } catch {
    return null;
  }
}
