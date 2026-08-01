import Link from "next/link";
import type { Metadata } from "next";
import { getPage, renderMarkdown } from "@/lib/pages";
import { PageHero } from "@/components/site";
import { Icon } from "@/components/Icon";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("home");
  return {
    title: page?.metaTitle || "Paws Playcare Watford",
    description: page?.metaDescription || undefined,
  };
}

// The six promises from the current pawsplaycare.co.uk homepage, now with
// classy keyline icons.
const FEATURES = [
  { img: "/brand/social-playtime.webp", title: "Social playtime", sub: "Dogs play and socialise together" },
  { img: "/brand/qualified-dog-trainers.webp", title: "Qualified dog trainers", sub: "Cared for by trained experts" },
  { img: "/brand/pick-up-drop-off.webp", title: "Pick up & drop off", sub: "Included with every booking" },
  { img: "/brand/private-enclosed-paddock.webp", title: "Private enclosed paddock", sub: "A safe, secure space to run" },
  { img: "/brand/fully-insured.webp", title: "Fully insured", sub: "Professional standards throughout" },
  { img: "/brand/dbs-checked.webp", title: "DBS checked", sub: "Trustworthy, vetted team" },
];

export default async function HomePage() {
  const page = await getPage("home");
  if (!page) return null;

  return (
    <>
      <PageHero heading={page.heroHeading || page.title} sub={page.heroSub} image={page.heroImage} />

      {/* Book now band */}
      <section className="bg-brand">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-5 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-lg font-semibold text-white">
            Ready to give your dog their best day? Pickup &amp; drop-off included.
          </p>
          <Link
            href="/online-booking-form"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-base font-bold text-brand shadow-sm transition hover:bg-white/90"
          >
            Book now <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Welcome / body content — above the icons */}
      <div className="mx-auto w-full max-w-3xl px-5 py-16 text-center">
        <article
          className="prose-site prose-site-center"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body) }}
        />
      </div>

      {/* Feature grid — the homepage promises with classy line icons */}
      <section className="bg-mist">
        <div className="mx-auto grid w-full max-w-5xl gap-x-6 gap-y-10 px-5 py-16 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group flex flex-col items-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.img} alt="" className="ppc-feature h-24 w-24" />
              <h3 className="mt-4 text-lg font-extrabold text-foreground">{f.title}</h3>
              <p className="mt-1 max-w-[16rem] text-sm text-muted">{f.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="mx-auto w-full max-w-3xl px-5 py-16 text-center">
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/online-booking-form" className="btn-primary px-6 py-3 text-base">
            Book a walk
          </Link>
          <Link href="/our-services" className="btn-outline px-6 py-3 text-base">
            See our services
          </Link>
        </div>
      </div>
    </>
  );
}
