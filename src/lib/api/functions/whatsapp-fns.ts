import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { client, ensureMigrated } from "../db";
import { checkWhatsappTestLimits, sendWhatsappTest, whatsappTestConfig } from "../whatsapp-test";
import { verifyWhatsappPasscode } from "../whatsapp-test";
import { whatsappTargetKey } from "../whatsapp-events";

export const getWhatsappTestStatus = createServerFn({ method: "GET" }).handler(() => ({
  configured: !!whatsappTestConfig(process.env),
}));

export const sendWhatsappTestMessage = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({ passcode: z.string().min(1).max(200) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) =>
    sendWhatsappTest(whatsappTestConfig(process.env), data.passcode, async () => {
      await ensureMigrated();
      const transaction = await client.transaction("write");
      try {
        const now = Date.now();
        await transaction.execute({
          sql: "DELETE FROM whatsapp_test_attempts WHERE sent_at <= ?",
          args: [now - 86_400_000],
        });
        const result = await transaction.execute("SELECT sent_at FROM whatsapp_test_attempts");
        checkWhatsappTestLimits(
          result.rows.map((row) => ({ sentAt: Number(row.sent_at) })),
          now,
        );
        await transaction.execute({
          sql: "INSERT INTO whatsapp_test_attempts (sent_at) VALUES (?)",
          args: [now],
        });
        await transaction.commit();
      } finally {
        transaction.close();
      }
    }),
  );

export const getWhatsappForwardingStatus = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).strict().parse(input))
  .handler(async ({ data }) => {
    await ensureMigrated();
    const config = whatsappTestConfig(process.env);
    const row = (
      await client.execute({
        sql: "SELECT * FROM whatsapp_demo_connections WHERE workspace_id=?",
        args: [data.workspaceId],
      })
    ).rows[0];
    const history = (
      await client.execute({
        sql: "SELECT action,status,error,created_at FROM whatsapp_event_outbox WHERE workspace_id=? ORDER BY created_at DESC,id DESC LIMIT 8",
        args: [data.workspaceId],
      })
    ).rows;
    return {
      active: !!(
        config &&
        row &&
        Number(row.expires_at) > Date.now() &&
        row.target_key === whatsappTargetKey(config)
      ),
      expiresAt: row ? Number(row.expires_at) : null,
      history: history.map((item) => ({
        action: String(item.action),
        status: String(item.status),
        error: item.error ? String(item.error) : null,
        createdAt: Number(item.created_at),
      })),
    };
  });

export const setWhatsappForwarding = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        passcode: z.string().min(1).max(200),
        enabled: z.boolean(),
        repliedToSender: z.boolean().optional(),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const config = whatsappTestConfig(process.env);
    verifyWhatsappPasscode(config, data.passcode);
    if (data.enabled && !data.repliedToSender)
      throw new Error(
        "Reply to the test sender on WhatsApp first and confirm that you have done so.",
      );
    await ensureMigrated();
    const workspace = (
      await client.execute({
        sql: "SELECT id FROM demo_workspaces WHERE id=?",
        args: [data.workspaceId],
      })
    ).rows[0];
    if (!workspace) throw new Error("Demo workspace not found. Create a demo share link first.");
    if (!data.enabled) {
      await client.execute({
        sql: "DELETE FROM whatsapp_demo_connections WHERE workspace_id=?",
        args: [data.workspaceId],
      });
      return { active: false, expiresAt: null };
    }
    const expiresAt = Date.now() + 3_600_000;
    await client.execute({
      sql: "INSERT INTO whatsapp_demo_connections(workspace_id,expires_at,target_key) VALUES(?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET expires_at=excluded.expires_at,target_key=excluded.target_key",
      args: [data.workspaceId, expiresAt, whatsappTargetKey(config)],
    });
    return { active: true, expiresAt };
  });
