import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { client } from "../db";
import { demoCall } from "../../demo-store";

const workspaceId = z.string().uuid();
const roleSchema = z.enum(["admin", "staff", "tenant"]);
export const createDemoWorkspace = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        entries: z
          .record(z.string().max(3_000_000))
          .refine(
            (value) => JSON.stringify(value).length < 8_000_000,
            "Demo is too large to share",
          ),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const entries = Object.fromEntries(
      Object.entries(data.entries).filter(([key]) => key.startsWith("pgone.demo.")),
    );
    const id = crypto.randomUUID();
    await client.execute({
      sql: "INSERT INTO demo_workspaces(id,payload,updated_at) VALUES(?,?,?)",
      args: [id, JSON.stringify(entries), new Date().toISOString()],
    });
    return { id };
  });

export const sharedDemoAction = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: workspaceId,
        role: roleSchema,
        name: z.string().max(80),
        input: z.unknown().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const transaction = await client.transaction("write");
    try {
      const row = (
        await transaction.execute({
          sql: "SELECT payload FROM demo_workspaces WHERE id=?",
          args: [data.id],
        })
      ).rows[0];
      if (!row) throw new Error("Shared demo not found. Ask the owner for a new link.");
      const entries: Record<string, string> = JSON.parse(String(row.payload));
      const result =
        data.name === "snapshot"
          ? null
          : demoCall(data.name, data.input, {
              role: data.role,
              storage: {
                getItem: (key) => entries[key] ?? null,
                setItem: (key, value) => {
                  entries[key] = value;
                },
              },
            });
      if (JSON.stringify(entries).length > 8_000_000)
        throw new Error("Shared demo storage is full");
      await transaction.execute({
        sql: "UPDATE demo_workspaces SET payload=?,updated_at=? WHERE id=?",
        args: [JSON.stringify(entries), new Date().toISOString(), data.id],
      });
      await transaction.commit();
      return { result: JSON.stringify(result ?? null), entries };
    } catch (error) {
      await transaction.rollback();
      throw error;
    } finally {
      transaction.close();
    }
  });
