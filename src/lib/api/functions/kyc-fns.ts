import { createServerFn } from "@tanstack/react-start";
import { eq, and } from "drizzle-orm";
import { db, client } from "../db";
import { tenants, bookings, properties } from "../db/schema";
import { getTenantSession, getSession } from "../auth";
import { z } from "zod";
import { kycDocumentInput, validateKycDocument, type KycDocument } from "../../kyc-document";

export const getMyKyc = createServerFn({ method: "GET" }).handler(async () => {
  const session = getTenantSession();
  if (!session) throw new Error("Please sign in first");
  const tenant = await db.select().from(tenants).where(eq(tenants.id, session.tenantId)).get();
  if (!tenant) throw new Error("Resident not found");
  return {
    status: tenant.kycStatus,
    proofType: tenant.idProofType,
    hasProofDetails: !!tenant.idProofNumber,
  };
});

export const uploadMyKycDocument = createServerFn({ method: "POST" })
  .validator((input: unknown) => kycDocumentInput.parse(input))
  .handler(async ({ data }) => {
    const session = getTenantSession();
    if (!session) throw new Error("Please sign in as a resident first");
    const document = validateKycDocument(data);
    const tenant = await db.select().from(tenants).where(eq(tenants.id, session.tenantId)).get();
    if (!tenant) throw new Error("Resident not found");
    await client.batch(
      [
        {
          sql: "INSERT INTO kyc_documents (tenant_id,payload) VALUES (?,?) ON CONFLICT(tenant_id) DO UPDATE SET payload=excluded.payload",
          args: [tenant.id, JSON.stringify({ ...document, uploadedAt: new Date().toISOString() })],
        },
        {
          sql: "UPDATE tenants SET id_proof_type=?, kyc_status='pending' WHERE id=?",
          args: [document.proofType, tenant.id],
        },
      ],
      "write",
    );
    return { ok: true };
  });

export const getKycDocument = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ tenantId: z.string() }).parse(input))
  .handler(async ({ data }): Promise<KycDocument | null> => {
    const resident = getTenantSession();
    const owner = getSession();
    if (resident?.tenantId !== data.tenantId) {
      if (!owner) throw new Error("Access denied");
      const owned = await db
        .select({ id: bookings.id })
        .from(bookings)
        .innerJoin(properties, eq(bookings.propertyId, properties.id))
        .where(and(eq(bookings.tenantId, data.tenantId), eq(properties.ownerId, owner.ownerId)))
        .get();
      if (!owned) throw new Error("Access denied");
    }
    const result = await client.execute({
      sql: "SELECT payload FROM kyc_documents WHERE tenant_id=?",
      args: [data.tenantId],
    });
    return result.rows[0] ? JSON.parse(String(result.rows[0].payload)) : null;
  });
