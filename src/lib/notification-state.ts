export function parseNotificationReads(raw: string): Record<string, boolean> {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const reads: Record<string, boolean> = {};
    for (const [id, read] of Object.entries(value)) if (typeof read === "boolean") {
      Object.defineProperty(reads, id, { value: read, enumerable: true, configurable: true, writable: true });
    }
    return reads;
  } catch { return {}; }
}

export const notificationStorageKey = (accountId: string) => `pgone.notification-reads.v1.${accountId}`;
