"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { bookEventPlace, cancelEventPlace } from "@/app/(site)/events/actions";

// Booking a place. Only signed-in clients can book, so the form starts filled
// in from their account; the dog's name is optional and only asked for when
// the event is set up that way.
export function EventBooking({
  eventId,
  askDogName,
  full,
  priceLabel,
  signedIn,
  booked,
  defaults,
}: {
  eventId: string;
  askDogName: boolean;
  full: boolean;
  priceLabel: string;
  signedIn: boolean;
  booked: boolean;
  defaults: { name: string; email: string; phone: string };
}) {
  const [name, setName] = useState(defaults.name);
  const [email, setEmail] = useState(defaults.email);
  const [phone, setPhone] = useState(defaults.phone);
  const [dogName, setDogName] = useState("");
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
          {message ?? "We've got your place saved. We'll see you there!"}
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
      <p className="text-sm text-muted">{priceLabel}.</p>

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
        {askDogName && (
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-muted">
              Dog&apos;s name (optional)
            </span>
            <input
              value={dogName}
              onChange={(e) => setDogName(e.target.value)}
              placeholder="Who's coming with you?"
              className="input w-full"
            />
          </label>
        )}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-muted">
          Anything we should know? (optional)
        </span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className="input w-full" />
      </label>

      <button
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await bookEventPlace(eventId, { name, email, phone, dogName, note });
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
