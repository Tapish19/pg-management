import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getKycDocument, uploadMyKycDocument } from "@/lib/demo-api";
import { useAuth } from "@/lib/auth";
import { validateKycDocument, type KycDocument } from "@/lib/kyc-document";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function download(document: KycDocument) {
  const bytes = Uint8Array.from(atob(document.base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: document.mime }));
  const link = window.document.createElement("a");
  link.href = url;
  link.download = document.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function KycDocuments({
  tenantId,
  canUpload = false,
}: {
  tenantId: string;
  canUpload?: boolean;
}) {
  const { isDemo } = useAuth();
  const client = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [proofType, setProofType] = useState<KycDocument["proofType"]>("aadhaar");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["kyc-document", tenantId],
    queryFn: () => getKycDocument({ data: { tenantId } }),
    refetchInterval: 30_000,
  });
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    if (!file) {
      setError("Choose a document first");
      return;
    }
    setSaving(true);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("Document must be 2 MB or smaller");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read document"));
        reader.readAsDataURL(file);
      });
      const document = validateKycDocument({ proofType, name: file.name, mime: file.type, base64 });
      await uploadMyKycDocument({ data: document });
      await client.invalidateQueries();
      setFile(null);
      form.reset();
      toast.success("Document uploaded. Your owner can review it now.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-3 mt-3">
      {query.isLoading ? (
        <p>Loading document…</p>
      ) : query.isError ? (
        <p role="alert">
          Could not load document.{" "}
          <Button variant="outline" onClick={() => query.refetch()}>
            Retry
          </Button>
        </p>
      ) : query.data ? (
        <div>
          <p className="text-sm">
            {query.data.name} · {query.data.proofType}
          </p>
          <Button variant="outline" onClick={() => download(query.data!)}>
            Download document
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No document uploaded.</p>
      )}
      {canUpload && (
        <form onSubmit={upload} className="space-y-3">
          {isDemo && (
            <p className="text-sm text-muted-foreground">
              Use a sample document in the demo. Anyone with your demo link can explore its roles.
            </p>
          )}
          <Label htmlFor={`proof-${tenantId}`}>Document type</Label>
          <select
            id={`proof-${tenantId}`}
            className="block border rounded p-2 w-full"
            value={proofType}
            onChange={(e) => setProofType(e.target.value as KycDocument["proofType"])}
          >
            <option value="aadhaar">Aadhaar</option>
            <option value="passport">Passport</option>
            <option value="driving-license">Driving license</option>
            <option value="other">Other ID</option>
          </select>
          <Label htmlFor={`document-${tenantId}`}>ID document (PDF, PNG or JPEG, up to 2 MB)</Label>
          <Input
            id={`document-${tenantId}`}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Uploading…" : "Upload document"}
          </Button>
        </form>
      )}
    </div>
  );
}
