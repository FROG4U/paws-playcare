import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage, renderMarkdown } from "@/lib/pages";
import { PageHero } from "@/components/site";
import { PricesTable } from "./PricesTable";
import { ContactForm } from "./ContactForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "Not found" };
  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || undefined,
  };
}

export default async function DynamicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page || !page.published) notFound();

  return (
    <>
      <PageHero heading={page.heroHeading || page.title} sub={page.heroSub} image={page.heroImage} />
      <div className="mx-auto w-full max-w-3xl px-5 py-12">
        <article
          className="prose-site"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body) }}
        />
        {slug === "prices" && (
          <div className="mt-8">
            <PricesTable />
          </div>
        )}
        {slug === "contact" && (
          <div className="mt-8">
            <ContactForm />
          </div>
        )}
      </div>
    </>
  );
}
