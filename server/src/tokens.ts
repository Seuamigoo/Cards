import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

export interface AccessClaims {
  readonly sub: string;
  readonly role: "player" | "admin";
  readonly username: string;
}

export function signAccess(claims: AccessClaims, secret: string): string {
  return jwt.sign({ role: claims.role, username: claims.username }, secret, {
    subject: claims.sub,
    expiresIn: "15m",
  });
}

export function readAccess(token: string, secret: string): AccessClaims | null {
  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      return null;
    }
    if (payload.role !== "player" && payload.role !== "admin") {
      return null;
    }
    if (typeof payload.username !== "string") {
      return null;
    }
    return { sub: payload.sub, role: payload.role, username: payload.username };
  } catch {
    return null;
  }
}

export function newRefreshToken(): { readonly token: string; readonly tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
