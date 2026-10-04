import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { demoPages } from "@/lib/demo-store";
import { ROLE_KEY, rolePages } from "@/lib/demo-role-access";
import { shareDemo, runDemoAction } from "@/lib/demo-sharing";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { toast } from "sonner";

export function DemoSharingCard() {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true);
    try {
      setLink(await shareDemo());
      toast.success("Shared demo ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not share demo");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="p-6 mb-4 max-w-2xl space-y-3">
      <h2 className="font-semibold">Share this demo</h2>
      <p className="text-sm text-muted-foreground">
        Create a link to explore the same records across browsers and devices. Anyone with the link
        can use the demo roles. Changes refresh within 15 seconds.
      </p>
      <Button onClick={share} disabled={busy}>
        {busy ? "Creating link…" : "Create share link"}
      </Button>
      {link && (
        <>
          <Input aria-label="Demo share link" readOnly value={link} />
          <Button
            variant="outline"
            onClick={() =>
              navigator.clipboard
                .writeText(link)
                .then(() => toast.success("Link copied"))
                .catch(() => toast.error("Select and copy the link above"))
            }
          >
            Copy link
          </Button>
        </>
      )}
    </Card>
  );
}
export function DemoRoleEditor({ role }: { role: "admin" | "staff" | "tenant" }) {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  async function save() {
    setSaving(true);
    try {
      await runDemoAction("getDemoConfig");
      await runDemoAction("saveDemoConfig", {
        key: ROLE_KEY,
        value: {
          staff: role === "staff" ? pages : rolePages("staff"),
          tenant: role === "tenant" ? pages : rolePages("tenant"),
        },
      });
      window.dispatchEvent(new Event("demo-synced"));
      await queryClient.invalidateQueries();
      setOpen(false);
      toast.success("Role access saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save access");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) setPages(rolePages(role));
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {role === "admin" ? "View access" : "Edit access"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role} access</DialogTitle>
        </DialogHeader>
        {demoPages[role].map((path) => (
          <label key={path} className="flex items-center justify-between gap-3">
            <span>{path.slice(1).replaceAll("-", " ")}</span>
            <Switch
              aria-label={`${role} ${path.slice(1)}`}
              checked={pages.includes(path)}
              disabled={role === "admin" || ["/dashboard", "/profile"].includes(path)}
              onCheckedChange={(checked) =>
                setPages((current) =>
                  checked ? [...current, path] : current.filter((p) => p !== path),
                )
              }
            />
          </label>
        ))}
        {role !== "admin" && (
          <>
            <Button disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save access"}
            </Button>
            <Button variant="outline" onClick={() => setPages(demoPages[role])}>
              Restore defaults
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
