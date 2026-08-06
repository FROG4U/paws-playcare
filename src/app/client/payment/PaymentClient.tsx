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

// loadStripe is memoised so we hit Stripe.js once, not on every render.
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

export function PaymentClient({
  publishableKey,
  card,
  returnTo,
}: {
  publishableKey: string;
  card: Card;
  returnTo?: string | null;
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
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setClientSecret(res.clientSecret);
  }, []);

  const onSaved = useCallback(() => {
    setClientSecret(null);
    // Came here mid-booking → go back so their filled-in booking is waiting.
    if (returnTo) router.push(returnTo);
    else router.refresh();
  }, [router, returnTo]);

  const onRemove = useCallback(async () => {
    setRemoving(true);
    await removeCard();
    setRemoving(false);
    router.refresh();
  }, [router]);

  // Actively entering a card → show the Stripe Elements form.
  if (clientSecret) {
    return (
      <div className="card space-y-4">
        <h2 className="text-lg font-bold">
          {card?.last4 ? "Replace your card" : "Add a card"}
        </h2>
        <Elements
          stripe={stripePromise(publishableKey)}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#2ea6d8",
                borderRadius: "12px",
                fontFamily: "inherit",
              },
            },
          }}
        >
          <CardForm
            isReplace={!!card?.last4}
            onSaved={onSaved}
            onCancel={() => setClientSecret(null)}
          />
        </Elements>
      </div>
    );
  }

  // Card already on file → summary + replace / remove.
  if (card?.last4) {
    return (
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-16 place-items-center rounded-xl bg-brand-soft text-xs font-bold uppercase tracking-wide text-brand-dark">
            {brandLabel(card.brand)}
          </span>
          <div>
            <p className="font-bold">
              {brandName(card.brand)} ···· {card.last4}
            </p>
            {card.expMonth && card.expYear && (
              <p className="text-sm text-muted">
                Expires {pad2(card.expMonth)}/{String(card.expYear).slice(-2)}
              </p>
            )}
          </div>
          <span className="badge ml-auto bg-success/15 text-success">
            Active
          </span>
        </div>
        <p className="text-sm text-muted">
          We&apos;ll charge this card automatically after each completed walk.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={beginAdd}
            disabled={starting}
            className="btn-outline"
          >
            {starting ? "Starting…" : "Replace card"}
          </button>
          <button
            onClick={onRemove}
            disabled={removing}
            className="btn-ghost text-danger"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    );
  }

  // No card yet → prompt.
  return (
    <div className="card space-y-4">
      <div className="flex items-start gap-3">
        <Icon name="card" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div>
          <p className="font-bold">No card on file</p>
          <p className="text-sm text-muted">
            Add a card to start booking walks. You won&apos;t be charged until a
            walk is completed.
          </p>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button onClick={beginAdd} disabled={starting} className="btn-primary">
        {starting ? "Starting…" : "Add a card"}
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
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="btn-primary"
        >
          {submitting ? "Saving…" : isReplace ? "Save new card" : "Save card"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="btn-ghost"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const BRAND_NAMES: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

function brandName(brand: string | null) {
  if (!brand) return "Card";
  return BRAND_NAMES[brand.toLowerCase()] ?? "Card";
}

function brandLabel(brand: string | null) {
  if (!brand) return "Card";
  const key = brand.toLowerCase();
  if (key === "amex") return "Amex";
  return BRAND_NAMES[key] ?? "Card";
}
