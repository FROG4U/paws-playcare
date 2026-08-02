"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { archiveClient, unarchiveClient, deleteClient } from "./actions";

export function ClientActions({
  id,
  name,
  archived,
}: {
  id: string;
  name: string;
  archived: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doArchive = () =>
    start(async () => {
      setError(null);
      const res = archived ? await unarchiveClient(id) : await archiveClient(id);
      if (!res.ok) setError(res.error);
    });

  const doDelete = () =>
    start(async () => {
      setError(null);
      const res = await deleteClient(id);
      // On success this redirects; only errors return here.
      if (res && !res.ok) setError(res.error);
    });

  return (
    <div className="relative flex items-center gap-2">
      <button onClick={doArchive} disabled={pending} className="btn-ghost">
        <Icon name={archived ? "check" : "inbox"} className="h-4 w-4" />
        {archived ? "Unarchive" : "Archive"}
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        disabled={pending}
        className="btn-ghost text-danger"
      >
        <Icon name="trash" className="h-4 w-4" />
        Delete
      </button>

      {error && (
        <span className="absolute right-0 top-full mt-1 whitespace-nowrap text-xs text-danger">
          {error}
        </span>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => !pending && setConfirmDelete(false)}>
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-danger/10 text-danger">
                <Icon name="alert" className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-bold">Delete {name}?</h3>
                <p className="text-sm text-muted">
                  This permanently removes the client and all their dogs, bookings,
                  walks and invoices. This can&apos;t be undone. Consider archiving
                  instead.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" disabled={pending} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button className="btn-danger" disabled={pending} onClick={doDelete}>
                {pending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
