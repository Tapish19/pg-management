import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { NOTIFICATIONS } from "@/lib/demo-data";
import { getMyNotices } from "@/lib/demo-api";
import { getOwnerNotifications } from "@/lib/demo-api";
import { notificationStorageKey, parseNotificationReads } from "@/lib/notification-state";

const EVENT = "pgone-notification-reads";
const memory = new Map<string, string>();
function subscribe(callback: () => void) {
  const onStorage = () => {
    memory.clear();
    callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}
function snapshot(key: string) {
  try {
    return memory.get(key) ?? localStorage.getItem(key) ?? "{}";
  } catch {
    return memory.get(key) ?? "{}";
  }
}

export function useNotifications() {
  const { user, isDemo } = useAuth();
  const key = notificationStorageKey(user?.id ?? "signed-out");
  const raw = useSyncExternalStore(
    subscribe,
    () => snapshot(key),
    () => "{}",
  );
  const reads = parseNotificationReads(raw);
  const resident = user?.role === "tenant";
  const owner = user?.role === "admin" || (isDemo && user?.role === "staff");
  const query = useQuery({
    queryKey: ["my-notices", user?.id],
    queryFn: () => getMyNotices(),
    enabled: resident,
    refetchInterval: 30_000,
  });
  const ownerQuery = useQuery({
    queryKey: ["owner-notifications", user?.id],
    queryFn: () => getOwnerNotifications(),
    enabled: owner,
    refetchInterval: 30_000,
  });
  const notifications = resident
    ? [...(query.data ?? [])]
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
        .map((notice) => ({
          id: notice.id,
          title: notice.title,
          body: notice.body,
          category: "notice",
          time: notice.createdAt ? new Date(notice.createdAt).toLocaleString() : "",
          read: false,
        }))
    : owner
      ? (ownerQuery.data ?? []).map((item) => ({
          ...item,
          time: item.createdAt ? new Date(item.createdAt).toLocaleString() : "",
        }))
      : isDemo
        ? NOTIFICATIONS.filter((notice) => notice.role === user?.role || notice.role === "all")
        : [];
  const items = notifications.map((notice) => ({
    ...notice,
    read: reads[notice.id] ?? notice.read,
  }));
  function update(changes: Record<string, boolean>) {
    const next = JSON.stringify({ ...parseNotificationReads(snapshot(key)), ...changes });
    memory.set(key, next);
    try {
      localStorage.setItem(key, next);
    } catch {
      /* Retain read status in memory if storage is unavailable. */
    }
    window.dispatchEvent(new Event(EVENT));
  }
  return {
    items,
    isLoading: resident ? query.isLoading : owner && ownerQuery.isLoading,
    error: resident ? query.error : owner ? ownerQuery.error : null,
    refetch: owner ? ownerQuery.refetch : query.refetch,
    toggle: (id: string) => update({ [id]: !items.find((item) => item.id === id)?.read }),
    markAllRead: () => update(Object.fromEntries(items.map((item) => [item.id, true]))),
  };
}
