"use client";

import { useState, useTransition } from "react";
import {
  blockFieldClient,
  unblockFieldClient,
  archiveFieldClient,
  deleteFieldClient,
} from "../actions";

export function ClientActions({
  id,
  blocked,
  archived,
}: {
  id: string;
  blocked: boolean;
  archived: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {blocked ? (
        <button onClick={() => start(() => unblockFieldClient(id))} disabled={pending} className="btn-ghost text-xs">
          Unblock
        </button>
      ) : (
        <button
          onClick={() => {
            const reason = window.prompt("Reason for blocking (optional):") ?? "";
            start(() => blockFieldClient(id, reason));
          }}
          disabled={pending}
          className="btn-ghost text-xs text-danger"
        >
          Block
        </button>
      )}
      <button onClick={() => start(() => archiveFieldClient(id, !archived))} disabled={pending} className="btn-ghost text-xs">
        {archived ? "Unarchive" : "Archive"}
      </button>
      {confirmDelete ? (
        <>
          <button
            onClick={() => start(() => deleteFieldClient(id))}
            disabled={pending}
            className="rounded-md bg-danger px-2 py-1 text-xs font-semibold text-white"
          >
            Confirm delete
          </button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted">Keep</button>
        </>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="btn-ghost text-xs text-danger">Delete</button>
      )}
    </div>
  );
}
