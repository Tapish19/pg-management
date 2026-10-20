import { z } from "zod";

export const visitorRequestInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    purpose: z.string().trim().max(500).optional(),
  })
  .strict();
export const visitorReviewInput = z
  .object({
    id: z.string().min(1),
    decision: z.enum(["approved", "rejected"]),
  })
  .strict();
export type VisitorApproval = "pending" | "approved" | "rejected";

export function visitorReviewChanges(current: string, decision: VisitorApproval) {
  if (current === decision) return false;
  if (current !== "pending") throw new Error("This visitor request has already been decided.");
  return true;
}
export function visitorVisitStatus(visitor: {
  approvalStatus: string;
  checkIn: string;
  checkOut: string | null;
}) {
  if (visitor.approvalStatus === "pending") return "Awaiting owner approval";
  if (visitor.approvalStatus === "rejected") return "Rejected";
  if (visitor.checkOut) return "Checked out";
  return visitor.checkIn ? "Checked in" : "Approved · not arrived";
}
export function compareVisitorRequests(
  a: { approvalStatus: string; createdAt: string | null; checkIn: string },
  b: { approvalStatus: string; createdAt: string | null; checkIn: string },
) {
  return (
    Number(b.approvalStatus === "pending") - Number(a.approvalStatus === "pending") ||
    (Date.parse(b.createdAt || b.checkIn) || 0) - (Date.parse(a.createdAt || a.checkIn) || 0)
  );
}
