import { randomBytes } from "node:crypto";

export function generateOAuthState(): string {
  return randomBytes(32).toString("hex");
}
