import { createHash } from "node:crypto";
import type { Transaction } from "@libsql/client";
import { client } from "./db";
import {
  demoWhatsappEvent,
  demoWhatsappMessages,
  whatsappEventActions,
} from "../whatsapp-demo-events";
import { sendWhatsappPayload, whatsappTestConfig, type WhatsappConfig } from "./whatsapp-test";

export const whatsappTargetKey = (config: WhatsappConfig) =>
  createHash("sha256").update(`${config.phoneNumberId}:${config.recipient}`).digest("hex");

export async function enqueueWhatsappEvent(
  transaction: Transaction,
  workspaceId: string,
  action: string,
  beforeIds: Set<string>,
  entries: Record<string, string>,
) {
  if (!whatsappEventActions.has(action)) return null;
  const config = whatsappTestConfig(process.env);
  if (!config) return null;
  const connection = (
    await transaction.execute({
      sql: "SELECT expires_at, target_key FROM whatsapp_demo_connections WHERE workspace_id=?",
      args: [workspaceId],
    })
  ).rows[0];
  if (
    !connection ||
    Number(connection.expires_at) <= Date.now() ||
    connection.target_key !== whatsappTargetKey(config)
  )
    return null;
  const event = demoWhatsappEvent(action, beforeIds, demoWhatsappMessages(entries));
  if (!event) return null;
  const id = createHash("sha256")
    .update(JSON.stringify([workspaceId, event.ids]))
    .digest("hex");
  await transaction.execute({
    sql: "INSERT OR IGNORE INTO whatsapp_event_outbox(id,workspace_id,action,body,created_at) VALUES(?,?,?,?,?)",
    args: [id, workspaceId, action, event.body, Date.now()],
  });
  return id;
}

export async function deliverWhatsappEvent(id: string, request: typeof fetch = fetch) {
  const config = whatsappTestConfig(process.env);
  if (!config)
    return { status: "failed", error: "WhatsApp sending is disabled or not configured." };
  const transaction = await client.transaction("write");
  let body: string | undefined;
  try {
    const row = (
      await transaction.execute({
        sql: "SELECT * FROM whatsapp_event_outbox WHERE id=?",
        args: [id],
      })
    ).rows[0];
    if (!row || row.status !== "pending") return null;
    const connection = (
      await transaction.execute({
        sql: "SELECT * FROM whatsapp_demo_connections WHERE workspace_id=?",
        args: [String(row.workspace_id)],
      })
    ).rows[0];
    let error = "";
    if (
      !connection ||
      Number(connection.expires_at) <= Date.now() ||
      connection.target_key !== whatsappTargetKey(config)
    )
      error = "Automatic demo forwarding is off or expired.";
    const counts = (
      await transaction.execute({
        sql: "SELECT count(*) AS daily, sum(CASE WHEN created_at > ? THEN 1 ELSE 0 END) AS recent FROM whatsapp_event_outbox WHERE status IN ('sending','accepted','failed') AND created_at > ?",
        args: [Date.now() - 60_000, Date.now() - 86_400_000],
      })
    ).rows[0];
    if (Number(counts.daily) >= 30 || Number(counts.recent) >= 5)
      error =
        "Automatic demo limit reached (5 attempts per minute, 30 per day). The PG action was saved.";
    await transaction.execute({
      sql: "UPDATE whatsapp_event_outbox SET status=?,error=? WHERE id=?",
      args: [error ? "skipped" : "sending", error || null, id],
    });
    await transaction.commit();
    if (error) return { status: "skipped", error };
    body = String(row.body);
  } finally {
    transaction.close();
  }
  let outcome: { status: string; error?: string };
  try {
    await sendWhatsappPayload(
      config,
      { type: "text", text: { preview_url: false, body } },
      request,
    );
    outcome = { status: "accepted" };
  } catch (failure) {
    const error =
      failure instanceof Error
        ? failure.message
        : "WhatsApp request failed. Check the delivery history.";
    outcome = { status: "failed", error };
  }
  // If this write fails, keep 'sending' (outcome unknown), rather than mislabelling an
  // already accepted Meta request as a provider failure or retrying it.
  await client.execute({
    sql: "UPDATE whatsapp_event_outbox SET status=?,error=? WHERE id=?",
    args: [outcome.status, outcome.error ?? null, id],
  });
  return outcome;
}
