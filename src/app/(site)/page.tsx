import Link from "next/link";
import type { Metadata } from "next";
import { getPage, renderMarkdown } from "@/lib/pages";
import { PageHero } from "@/components/site";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("home");
  return {
    title: page?.metaTitle || "Paws Playcare Watford",
    description: page?.metaDescription || undefined,
  };
}

export default async function HomePage() {
  const page = await getPage("home");
  if (!page) return null;

  return (
    <>
      <PageHero heading={page.heroHeading || page.title} sub={page.heroSub} image={page.heroImage} />
      <div className="mx-auto w-full max-w-3xl px-5 py-12">
        <article
          className="prose-site"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body) }}
        />
        <div className="mt-8 flex flex-wrap gap-3">
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
