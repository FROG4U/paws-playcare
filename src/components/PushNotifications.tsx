"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { savePushSubscription, removePushSubscription } from "@/app/actions/push";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = "loading" | "unsupported" | "off" | "on" | "denied" | "working";

// Lets a signed-in user turn on push notifications for this device, so app
// alerts arrive like a phone message even when the app is closed.
export function EnablePushButton({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, [publicKey]);

  const enable = useCallback(async () => {
    setState("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      await savePushSubscription({
        endpoint: json.endpoint ?? "",
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      });
      setState("on");
    } catch {
      setState("off");
    }
  }, [publicKey]);

  const disable = useCallback(async () => {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }, []);

  if (state === "loading" || state === "unsupported") return null;

  const base =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9rem] font-medium transition";

  if (state === "denied") {
    return (
      <div className={`${base} text-muted`} title="Notifications are blocked in your browser settings">
        <Icon name="bell" className="h-[1.15rem] w-[1.15rem]" />
        <span className="flex-1 text-left">Notifications blocked</span>
      </div>
    );
  }

  const on = state === "on";
  return (
    <button
      onClick={on ? disable : enable}
      disabled={state === "working"}
      className={`${base} ${on ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-brand-soft hover:text-brand-dark"}`}
    >
      <Icon name="bell" className="h-[1.15rem] w-[1.15rem]" />
      <span className="flex-1 text-left">
        {state === "working" ? "…" : on ? "Notifications on" : "Turn on notifications"}
      </span>
      {on && <span className="text-xs text-success">✓</span>}
    </button>
  );
}

// Mirrors the unread count onto the installed-app icon (Badging API).
export function AppBadge({ count }: { count: number }) {
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;
    if (count > 0) nav.setAppBadge(count).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [count]);
  return null;
}
