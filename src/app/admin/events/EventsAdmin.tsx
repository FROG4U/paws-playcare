"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import {
  saveEvent,
  setEventActive,
  unarchiveEvent,
  deleteEvent,
  removeSignup,
  type Result,
} from "./actions";

export type SignupLite = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  dogName: string | null;
  note: string | null;
  whenLabel: string;
};

export type EventLite = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  imagePath: string | null;
  address: string | null;
  dateIso: string;
  whenLabel: string;
  startTime: string | null;
  endTime: string | null;
  pricePounds: string | null; // "12.00"
  priceLabel: string;
  capacity: number | null;
  askDogName: boolean;
  active: boolean;
  archived: boolean;
  booked: number;
  placesLeft: number | null;
  signups: SignupLite[];
};

export function EventsAdmin({ events, todayIso }: { events: EventLite[]; todayIso: string }) {
  const [editing, setEditing] = useState<EventLite | "new" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const upcoming = events.filter((e) => !e.archived);
  const archived = events.filter((e) => e.archived);

  function run(fn: () => Promise<Result>) {
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setMessage(res.message);
        setEditing(null);
      } else setError(res.error);
    });
  }

  return (
    <div className="space-y-5">
      {!editing && (
        <button onClick={() => { setEditing("new"); setMessage(null); }} className="btn-primary">
          <Icon name="plus" className="h-4 w-4" />
          New event
        </button>
      )}

      {editing && (
        <EventForm
          event={editing === "new" ? null : editing}
          todayIso={todayIso}
          pending={pending}
          onCancel={() => { setEditing(null); setError(null); }}
          onSubmit={(fd) => run(() => saveEvent(fd))}
        />
      )}

      {message && <p className="text-sm font-semibold text-brand">{message}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!editing && (
        <>
          <Section
            title="Events"
            empty="No events yet. Create one and it'll show on the website once it's switched on."
            events={upcoming}
            onEdit={setEditing}
            onRun={run}
            pending={pending}
          />
          {archived.length > 0 && (
            <Section
              title={`Past events (${archived.length})`}
              empty=""
              events={archived}
              onEdit={setEditing}
              onRun={run}
              pending={pending}
              archived
            />
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  events,
  onEdit,
  onRun,
  pending,
  archived,
}: {
  title: string;
  empty: string;
  events: EventLite[];
  onEdit: (e: EventLite) => void;
  onRun: (fn: () => Promise<Result>) => void;
  pending: boolean;
  archived?: boolean;
}) {
  if (events.length === 0 && !empty) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Icon name="sparkles" className="h-5 w-5 text-brand" />
        {title}
      </h2>
      {events.length === 0 ? (
        <p className="card text-sm text-muted">{empty}</p>
      ) : (
        events.map((e) => (
          <EventCard
            key={e.id}
            e={e}
            onEdit={() => onEdit(e)}
            onRun={onRun}
            pending={pending}
            archived={archived}
          />
        ))
      )}
    </section>
  );
}

function EventCard({
  e,
  onEdit,
  onRun,
  pending,
  archived,
}: {
  e: EventLite;
  onEdit: () => void;
  onRun: (fn: () => Promise<Result>) => void;
  pending: boolean;
  archived?: boolean;
}) {
  const [showList, setShowList] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {e.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.imagePath} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Icon name="sparkles" className="h-6 w-6" />
            </span>
          )}
          <div>
            <p className="font-bold">
              {e.title}
              {archived ? (
                <span className="ml-2 badge bg-border text-muted">archived</span>
              ) : e.active ? (
                <span className="ml-2 badge bg-success/15 text-success">on the site</span>
              ) : (
                <span className="ml-2 badge bg-mist text-muted">off</span>
              )}
            </p>
            <p className="text-sm text-muted">
              {e.whenLabel} · {e.priceLabel}
              {e.address ? ` · ${e.address}` : ""}
            </p>
            <p className="mt-0.5 text-sm">
              <button
                onClick={() => setShowList((v) => !v)}
                className="font-semibold text-brand hover:underline"
              >
                {e.booked} booked
                {e.capacity != null ? ` of ${e.capacity}` : ""}
              </button>
              {e.placesLeft === 0 && <span className="ml-2 badge bg-warn/15 text-warn">full</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/events/${e.slug}`} className="btn-ghost text-sm">
            View page
          </Link>
          <button onClick={onEdit} className="btn-outline text-sm">
            <Icon name="pencil" className="h-4 w-4" /> Edit
          </button>
          {archived ? (
            <button
              onClick={() => onRun(() => unarchiveEvent(e.id))}
              disabled={pending}
              className="btn-outline text-sm"
            >
              Restore
            </button>
          ) : (
            <button
              onClick={() => onRun(() => setEventActive(e.id, !e.active))}
              disabled={pending}
              className={e.active ? "btn-ghost text-sm" : "btn-primary text-sm"}
            >
              {e.active ? "Turn off" : "Turn on"}
            </button>
          )}
          {confirmDelete ? (
            <>
              <button
                onClick={() => onRun(() => deleteEvent(e.id))}
                disabled={pending}
                className="rounded-xl bg-danger px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Delete for good
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn-ghost text-sm">
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
              aria-label="Delete event"
            >
              <Icon name="trash" className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {showList && (
        <div className="rounded-xl bg-background p-3">
          {e.signups.length === 0 ? (
            <p className="text-sm text-muted">Nobody booked yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {e.signups.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-semibold">
                      {s.name}
                      {s.dogName ? <span className="text-muted"> with {s.dogName}</span> : ""}
                    </p>
                    <p className="text-muted">
                      {s.email}
                      {s.phone ? ` · ${s.phone}` : ""} · booked {s.whenLabel}
                    </p>
                    {s.note && <p className="text-muted">&ldquo;{s.note}&rdquo;</p>}
                  </div>
                  <button
                    onClick={() => onRun(() => removeSignup(s.id))}
                    disabled={pending}
                    className="btn-ghost text-sm text-danger disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function EventForm({
  event,
  todayIso,
  pending,
  onCancel,
  onSubmit,
}: {
  event: EventLite | null;
  todayIso: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<string | null>(event?.imagePath ?? null);
  const [removeImage, setRemoveImage] = useState(false);

  return (
    <form
      ref={formRef}
      action={(fd) => onSubmit(fd)}
      className="card space-y-4"
      encType="multipart/form-data"
    >
      <h2 className="text-base font-bold">{event ? "Edit event" : "New event"}</h2>
      {event && <input type="hidden" name="id" value={event.id} />}

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-muted">Event title</span>
        <input name="title" defaultValue={event?.title ?? ""} required className="input w-full" />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">Date</span>
          <input
            type="date"
            name="date"
            defaultValue={event?.dateIso ?? ""}
            min={event ? undefined : todayIso}
            required
            className="input w-full"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">Start time</span>
          <input type="time" name="startTime" defaultValue={event?.startTime ?? ""} className="input w-full" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">End time</span>
          <input type="time" name="endTime" defaultValue={event?.endTime ?? ""} className="input w-full" />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-muted">Address</span>
        <input
          name="address"
          defaultValue={event?.address ?? ""}
          placeholder="Where it's happening"
          className="input w-full"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-muted">Description</span>
        <textarea
          name="description"
          rows={5}
          defaultValue={event?.description ?? ""}
          placeholder="What's on, what to bring, anything else people should know."
          className="input w-full"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">
            Price per person (leave blank if it's free)
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="price"
            defaultValue={event?.pricePounds ?? ""}
            placeholder="e.g. 10.00"
            className="input w-full"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">
            Places (leave blank for no limit)
          </span>
          <input
            type="number"
            min="1"
            step="1"
            name="capacity"
            defaultValue={event?.capacity ?? ""}
            placeholder="e.g. 20"
            className="input w-full"
          />
        </label>
      </div>

      <div className="space-y-2">
        <span className="block text-xs font-semibold text-muted">Photo</span>
        {preview && !removeImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-32 w-full max-w-xs rounded-xl object-cover" />
        )}
        <input
          type="file"
          name="image"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : event?.imagePath ?? null);
            setRemoveImage(false);
          }}
          className="block text-sm"
        />
        <p className="text-xs text-muted">
          Any size is fine - it's shrunk and saved as a small WebP automatically.
        </p>
        {event?.imagePath && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="removeImage"
              checked={removeImage}
              onChange={(e) => setRemoveImage(e.target.checked)}
            />
            Remove the current photo
          </label>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="askDogName" defaultChecked={event?.askDogName ?? true} className="mt-1" />
        <span>Ask for a dog&apos;s name on the booking form (optional for them to fill in)</span>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={event?.active ?? true} className="mt-1" />
        <span>
          <strong>Show on the website</strong> - untick to keep it hidden while you get it ready
        </span>
      </label>

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
          {pending ? "Saving..." : event ? "Save event" : "Create event"}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
