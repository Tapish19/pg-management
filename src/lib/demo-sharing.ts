import { createDemoWorkspace, sharedDemoAction } from "./api/functions/demo-sharing-fns";
import { demoCall, demoRole } from "./demo-store";
import { toast } from "sonner";
const KEY = "pgone.shared-demo.v1";
const CACHE_KEY = "pgone.shared-demo-cache.v1";
const snapshots = new Map<string, Promise<void>>();
export function sharedDemoId() {
  return localStorage.getItem(KEY);
}
function apply(id: string, entries: Record<string, string>) {
  // A response from a previous workspace must never replace the current demo.
  if (sharedDemoId() !== id) return;
  for (const key of Object.keys(localStorage))
    if (key.startsWith("pgone.demo.")) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(entries))
    if (key.startsWith("pgone.demo.")) localStorage.setItem(key, value);
  localStorage.setItem(CACHE_KEY, id);
  window.dispatchEvent(new Event("demo-synced"));
}
export function syncSharedDemo(role = demoRole()): Promise<void> {
  const id = sharedDemoId();
  if (!id || !role) return Promise.resolve();
  const pending = snapshots.get(id);
  if (pending) return pending;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  const request = (async () => {
    try {
      const response = await sharedDemoAction({
        data: { id, role, name: "snapshot" },
        signal: controller.signal,
      });
      apply(id, response.entries);
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error("The shared demo is taking too long to respond. Please try again.");
      throw error;
    } finally {
      window.clearTimeout(timeout);
      snapshots.delete(id);
    }
  })();
  snapshots.set(id, request);
  return request;
}
export async function joinSharedDemo(role = demoRole(), preferCache = false) {
  const id = new URL(window.location.href).searchParams.get("demo");
  if (id && /^[0-9a-f-]{36}$/i.test(id)) localStorage.setItem(KEY, id);
  if (!sharedDemoId() || !role) return;
  const cached =
    localStorage.getItem(CACHE_KEY) === sharedDemoId() &&
    !!localStorage.getItem("pgone.demo.data.v1");
  if (preferCache && cached) {
    // Opening another role uses the same records immediately; refresh in the background.
    void syncSharedDemo(role).catch(() =>
      toast.error("Shared demo could not refresh. Showing your last loaded records."),
    );
    return;
  }
  await syncSharedDemo(role);
}
export async function runDemoAction(name: string, input: unknown = {}): Promise<unknown> {
  const id = sharedDemoId(),
    role = demoRole();
  if (!id || !role) return demoCall(name, input);
  const response = await sharedDemoAction({ data: { id, role, name, input } });
  apply(id, response.entries);
  if (response.whatsapp?.error) toast.error(`Action saved. ${response.whatsapp.error}`);
  else if (response.whatsapp?.status === "accepted")
    toast.success("Demo update accepted by WhatsApp for your test phone");
  return JSON.parse(response.result);
}
export async function shareDemo() {
  let id = sharedDemoId();
  if (!id) {
    const entries = Object.fromEntries(
      Object.keys(localStorage)
        .filter((key) => key.startsWith("pgone.demo."))
        .map((key) => [key, localStorage.getItem(key)!]),
    );
    id = (await createDemoWorkspace({ data: { entries } })).id;
    localStorage.setItem(KEY, id);
    localStorage.setItem(CACHE_KEY, id);
  }
  return `${window.location.origin}/auth?demo=${id}`;
}
