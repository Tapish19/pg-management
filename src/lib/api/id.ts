import { randomBytes } from "crypto";

export function genId(prefix: string) {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}
