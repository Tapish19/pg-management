import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { client, ensureMigrated } from "../db";
import { checkWhatsappTestLimits, sendWhatsappTest, whatsappTestConfig } from "../whatsapp-test";

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
