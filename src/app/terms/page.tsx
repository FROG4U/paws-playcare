import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Terms & Conditions — Paws Playcare",
};

const sections: { heading: string; body: string[] }[] = [
  {
    heading: "1. Acceptance",
    body: [
      "By enrolling a dog with Paws Playcare you accept these terms and conditions. Where necessary, Paws Playcare may act as guardian for your dog and authorise veterinary treatment; any veterinary costs incurred are payable by you.",
    ],
  },
  {
    heading: "2. Cancellations",
    body: [
      "One week's notice of cancellation is required, otherwise the fees for the booked service remain due.",
      "There is no minimum contract term, but unused days cannot be swapped or carried forward to another week.",
    ],
  },
  {
    heading: "3. Payment",
    body: [
      "Full payment for services is required one week in advance, or at the time of booking.",
      "Payment is collected automatically to your card on file on your chosen schedule (daily, weekly or monthly). It is your responsibility to keep a valid card on file.",
    ],
  },
  {
    heading: "4. Liability",
    body: [
      "Paws Playcare's liability is limited to £1,000, or the total fees paid, whichever is the lower.",
      "You are not held liable for injury to your dog during vehicle transport or off-lead walks; however you remain responsible for veterinary costs arising from accident or sickness caused by your dog.",
    ],
  },
  {
    heading: "5. Your dog",
    body: [
      "Dogs must have current vaccinations, de-worming and de-fleaing treatment.",
      "You must disclose any history of aggressive behaviour. Paws Playcare reserves the right to decline or cancel services for any dog considered unsuitable.",
    ],
  },
  {
    heading: "6. Additional terms",
    body: [
      "Regular clients are given preference over ad-hoc adventure walks.",
      "Paws Playcare is closed on Christmas Day and New Year's Day.",
      "Consent to take photos and video of your dog is assumed unless you tell us otherwise in writing.",
    ],
  },
  {
    heading: "7. Data protection & governing law",
    body: [
      "Your data is stored securely and only shared where necessary to provide care for your dog (for example, with a vet). These terms are governed by the law of England and Wales.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/">
          <Logo className="text-xl" />
        </Link>
        <Link href="/register" className="btn-outline">
          Back to sign up
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 py-6">
        <h1 className="text-3xl font-extrabold">Terms &amp; Conditions</h1>
        <p className="mt-2 text-muted">
          Please read these terms carefully before booking with Paws Playcare.
        </p>
        <div className="mt-8 space-y-7">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-bold">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
        <p className="mt-10 text-xs text-muted">
          These terms mirror the current Paws Playcare policy. If your official
          wording differs, update this page&apos;s content.
        </p>
      </main>
    </div>
  );
}
