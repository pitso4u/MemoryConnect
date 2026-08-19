import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../config";

export interface AccessPayload {
  sub: string;
  email: string;
  name: string;
  tenantId: string;
  tenantName: string;
  role: string;
}

export function signAccess(payload: AccessPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl,
  } as jwt.SignOptions);
}

export function verifyAccess(token: string): AccessPayload {
  return jwt.verify(token, config.jwt.accessSecret) as AccessPayload;
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export interface RefreshPayload {
  sub: string;
  jti: string;
}

export function signRefresh(payload: RefreshPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: `${config.jwt.refreshTtlDays}d`,
  } as jwt.SignOptions);
}

export function verifyRefresh(token: string): RefreshPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as RefreshPayload;
}
