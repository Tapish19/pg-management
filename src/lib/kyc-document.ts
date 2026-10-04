import { z } from "zod";

export const kycDocumentInput = z.object({
  proofType: z.enum(["aadhaar", "passport", "driving-license", "other"]),
  name: z.string().trim().min(1).max(180),
  mime: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  base64: z
    .string()
    .min(1)
    .max(2_796_204)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
export type KycDocument = z.infer<typeof kycDocumentInput> & { uploadedAt: string };
export function validateKycDocument(input: unknown) {
  const document = kycDocumentInput.parse(input);
  const bytes = Uint8Array.from(atob(document.base64), (c) => c.charCodeAt(0));
  if (bytes.length > 2 * 1024 * 1024) throw new Error("Document must be 2 MB or smaller");
  const valid =
    document.mime === "application/pdf"
      ? String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
      : document.mime === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid) throw new Error("File content does not match its PDF, PNG or JPEG type");
  return document;
}
