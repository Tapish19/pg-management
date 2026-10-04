import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { tenants } from "../db/schema";
import { getTenantSession } from "../auth";

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
