"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markAllRead } from "@/app/actions/notifications";

// Marks notifications read as soon as the page is opened, then refreshes so the
// bell badge (computed in the layout) clears.
export function AutoMarkRead({ path, hasUnread }: { path: string; hasUnread: boolean }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (!hasUnread || done.current) return;
    done.current = true;
    (async () => {
      await markAllRead(path);
      router.refresh();
    })();
  }, [hasUnread, path, router]);

  return null;
}
