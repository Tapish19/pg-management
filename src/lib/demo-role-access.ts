import { demoPages, type DemoStorage } from "./demo-store";
import type { Role } from "./demo-data";
export const ROLE_KEY = "pgone.demo.roles.v1";
export function rolePages(role: Role, storage: DemoStorage = localStorage): string[] {
  if (role === "admin") return demoPages.admin;
  try {
    const selected = JSON.parse(storage.getItem(ROLE_KEY) ?? "{}")[role];
    if (Array.isArray(selected))
      return demoPages[role].filter(
        (path) => ["/dashboard", "/profile"].includes(path) || selected.includes(path),
      );
  } catch {
    /* defaults */
  }
  return demoPages[role];
}
export function validateRolePages(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Invalid role permissions");
  const result: Record<string, string[]> = {};
  for (const role of ["staff", "tenant"] as const) {
    const pages = (input as Record<string, unknown>)[role];
    if (
      !Array.isArray(pages) ||
      pages.some((path) => typeof path !== "string" || !demoPages[role].includes(path))
    )
      throw new Error("A role can only access its supported pages");
    result[role] = [...new Set(["/dashboard", "/profile", ...pages])];
  }
  return result;
}
export function actionPage(name: string): string | null {
  if (/Booking/.test(name) && !name.includes("My")) return "/bookings";
  if (/Task/.test(name)) return "/tasks";
  if (/Complaint/.test(name)) return name.includes("My") ? "/my-complaints" : "/complaints";
  if (/Visitor/.test(name)) return name.includes("My") ? "/my-visitors" : "/visitors";
  if (/Food/.test(name)) return name.includes("My") ? "/my-food" : "/food";
  if (/Notice/.test(name)) return name.includes("My") ? "/notifications" : "/notices";
  if (/Payment|verifyPayment/.test(name)) return "/pay-rent";
  if (name === "askAssistantFn") return "/my-assistant";
  return null;
}
