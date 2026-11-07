"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { bookEventPlace, cancelEventPlace } from "@/app/(site)/events/actions";

// Booking a place. Only signed-in clients can book, so the form starts filled
// in from their account; the dog's name is optional and only asked for when
// the event is set up that way.
export type EventDog = { id: string; name: string };

const money = (pence: number) =>
  `£${(pence / 100).toFixed(2)}`;

export function EventBooking({
  eventId,
  askDogName,
  full,
  priceLabel,
  signedIn,
  booked,
  dogs,
  bookedDogNames,
  billingNote,
  pricePence,
  defaults,
}: {
  eventId: string;
  askDogName: boolean;
  full: boolean;
  priceLabel: string;
  signedIn: boolean;
  booked: boolean;
  dogs: EventDog[];              // the client's own dogs
  bookedDogNames?: string | null; // who they already said is coming
  billingNote?: string | null;    // how a paid place will be charged
  pricePence?: number | null;     // per dog, for the running total
  defaults: { name: string; email: string; phone: string };
}) {
  const [name, setName] = useState(defaults.name);
  const [email, setEmail] = useState(defaults.email);
  const [phone, setPhone] = useState(defaults.phone);
  // One dog is the norm, so pre-tick it when that's all they have.
  const [dogIds, setDogIds] = useState<string[]>(dogs.length === 1 ? [dogs[0].id] : []);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(booked);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!signedIn) {
    return (
      <div className="card space-y-3">
        <h2 className="text-lg font-bold">Book your place</h2>
        <p className="text-sm text-muted">
          Places are for Paws Playcare customers, so please log in to book. {priceLabel}.
        </p>
        <Link href="/online-booking-form" className="btn-primary self-start">
          Log in to book
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card space-y-3">
        <p className="flex items-center gap-2 text-lg font-bold text-success">
          <Icon name="check" className="h-5 w-5" />
          You&apos;re booked in
        </p>
        <p className="text-sm text-muted">
          {message ??
            (bookedDogNames
              ? `We've got your place saved, with ${bookedDogNames}. We'll see you there!`
              : "We've got your place saved. We'll see you there!")}
        </p>
        <button
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await cancelEventPlace(eventId);
              if (res.ok) {
                setDone(false);
                setMessage(null);
              } else setError(res.error);
            })
          }
          disabled={pending}
          className="btn-ghost self-start text-sm disabled:opacity-50"
        >
          {pending ? "Cancelling..." : "Cancel my place"}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  if (full) {
    return (
      <div className="card space-y-2">
        <h2 className="text-lg font-bold">Fully booked</h2>
        <p className="text-sm text-muted">
          Every place has gone for this one. Give us a ring and we&apos;ll add you to the waiting list.
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-bold">Book your place</h2>
      <p className="text-sm text-muted">
        {priceLabel}.{billingNote ? ` ${billingNote}` : ""}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input w-full" />
        </label>
      </div>

      {askDogName && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">
            Which dog is coming? {dogs.length > 1 && "Pick as many as are joining you."}
          </p>
          {dogs.length === 0 ? (
            <p className="text-sm text-muted">
              There aren&apos;t any dogs on your account yet - add one in your profile and we&apos;ll
              know who to expect.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {dogs.map((d) => {
                const on = dogIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      setDogIds((prev) =>
                        prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                      )
                    }
                    className={
                      on
                        ? "inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-sm font-bold text-white"
                        : "inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-semibold text-muted hover:border-brand hover:text-brand"
                    }
                  >
                    <Icon name="paw" className="h-3.5 w-3.5" />
                    {d.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-muted">
          Anything we should know? (optional)
        </span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className="input w-full" />
      </label>

      {!!pricePence && dogIds.length > 0 && (
        <p className="rounded-lg bg-background px-3 py-2 text-sm">
          {dogIds.length} dog{dogIds.length > 1 ? "s" : ""} × {money(pricePence)} ={" "}
          <strong>{money(pricePence * dogIds.length)}</strong>
        </p>
      )}

      <button
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await bookEventPlace(eventId, { name, email, phone, dogIds, note });
            if (res.ok) {
              setDone(true);
              setMessage(res.message);
            } else setError(res.error);
          })
        }
        disabled={pending}
        className="btn-primary self-start disabled:opacity-50"
      >
        {pending ? "Booking..." : "Book my place"}
      </button>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
