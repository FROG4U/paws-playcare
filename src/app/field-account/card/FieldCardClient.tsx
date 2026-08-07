"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Icon } from "@/components/Icon";
import { removeCard, saveCard, startCardSetup } from "./actions";

let _stripePromise: Promise<Stripe | null> | null = null;
function stripePromise(key: string) {
  if (!_stripePromise) _stripePromise = loadStripe(key);
  return _stripePromise;
}

type Card = {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
} | null;

export function FieldCardClient({
  publishableKey,
  card,
}: {
  publishableKey: string;
  card: Card;
}) {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const beginAdd = useCallback(async () => {
    setError(null);
    setStarting(true);
    const res = await startCardSetup();
    setStarting(false);
    if (!res.ok) return setError(res.error);
    setClientSecret(res.clientSecret);
  }, []);

  const onRemove = useCallback(async () => {
    setRemoving(true);
    await removeCard();
    setRemoving(false);
    router.refresh();
  }, [router]);

  if (clientSecret) {
    return (
      <div className="card space-y-4">
        <h2 className="text-lg font-bold">{card?.last4 ? "Replace your card" : "Add a card"}</h2>
        <Elements
          stripe={stripePromise(publishableKey)}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: { colorPrimary: "#2ea6d8", borderRadius: "12px", fontFamily: "inherit" },
            },
          }}
        >
          <CardForm
            isReplace={!!card?.last4}
            onSaved={() => { setClientSecret(null); router.refresh(); }}
            onCancel={() => setClientSecret(null)}
          />
        </Elements>
      </div>
    );
  }

  if (card?.last4) {
    return (
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-16 place-items-center rounded-xl bg-brand-soft text-xs font-bold uppercase text-brand-dark">
            {card.brand ?? "Card"}
          </span>
          <div>
            <p className="font-bold capitalize">{card.brand} ···· {card.last4}</p>
            {card.expMonth && card.expYear && (
              <p className="text-sm text-muted">
                Expires {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
              </p>
            )}
          </div>
          <span className="badge ml-auto bg-success/15 text-success">Saved</span>
        </div>
        <p className="text-sm text-muted">
          We&apos;ll offer this card for faster checkout next time you book the field.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button onClick={beginAdd} disabled={starting} className="btn-outline">
            {starting ? "Starting…" : "Replace card"}
          </button>
          <button onClick={onRemove} disabled={removing} className="btn-ghost text-danger">
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-start gap-3">
        <Icon name="card" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div>
          <p className="font-bold">No saved card</p>
          <p className="text-sm text-muted">
            Save a card now for faster checkout — you can still pay per booking without one.
          </p>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button onClick={beginAdd} disabled={starting} className="btn-primary">
        {starting ? "Starting…" : "Save a card"}
      </button>
    </div>
  );
}

function CardForm({
  isReplace,
  onSaved,
  onCancel,
}: {
  isReplace: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: confirmErr, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });
    if (confirmErr) {
      setError(confirmErr.message ?? "We couldn't confirm that card.");
      setSubmitting(false);
      return;
    }
    if (!setupIntent?.id) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }
    const res = await saveCard(setupIntent.id);
    setSubmitting(false);
    if (!res.ok) return setError(res.error);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!stripe || submitting} className="btn-primary">
          {submitting ? "Saving…" : isReplace ? "Save new card" : "Save card"}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting} className="btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
