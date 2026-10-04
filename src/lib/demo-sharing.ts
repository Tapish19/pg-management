import { createDemoWorkspace, sharedDemoAction } from "./api/functions/demo-sharing-fns";
import { demoCall, demoRole } from "./demo-store";
const KEY = "pgone.shared-demo.v1";
export function sharedDemoId() {
  return localStorage.getItem(KEY);
}
function apply(entries: Record<string, string>) {
  for (const key of Object.keys(localStorage))
    if (key.startsWith("pgone.demo.")) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(entries))
    if (key.startsWith("pgone.demo.")) localStorage.setItem(key, value);
  window.dispatchEvent(new Event("demo-synced"));
}
export async function syncSharedDemo() {
  const id = sharedDemoId(),
    role = demoRole();
  if (!id || !role) return;
  const response = await sharedDemoAction({ data: { id, role, name: "snapshot" } });
  apply(response.entries);
}
export async function joinSharedDemo() {
  const id = new URL(window.location.href).searchParams.get("demo");
  if (id && /^[0-9a-f-]{36}$/i.test(id)) localStorage.setItem(KEY, id);
  await syncSharedDemo();
}
export async function runDemoAction(name: string, input: unknown = {}): Promise<unknown> {
  const id = sharedDemoId(),
    role = demoRole();
  if (!id || !role) return demoCall(name, input);
  const response = await sharedDemoAction({ data: { id, role, name, input } });
  apply(response.entries);
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
  }
  return `${window.location.origin}/auth?demo=${id}`;
}
