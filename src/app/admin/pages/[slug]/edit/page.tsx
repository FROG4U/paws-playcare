import Link from "next/link";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/pages";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { savePage, generateSeo, deletePage } from "../../actions";

export default async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ seo?: string }>;
}) {
  const { slug } = await params;
  const { seo } = await searchParams;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader icon="pencil" title={`Edit: ${page.title}`} subtitle={`/${slug === "home" ? "" : slug}`} />
        <Link href={slug === "home" ? "/" : `/${slug}`} target="_blank" className="btn-ghost">
          <Icon name="arrowRight" className="h-4 w-4" /> View live
        </Link>
      </div>

      {seo && (
        <p className="flex items-center gap-2 rounded-lg bg-success/15 px-3 py-2 text-sm text-success">
          <Icon name="sparkles" className="h-4 w-4" /> SEO generated and saved. Review the meta fields below, then Save changes.
        </p>
      )}

      <form action={savePage} className="space-y-6">
        <input type="hidden" name="slug" value={slug} />

        {/* Hero */}
        <section className="card space-y-4">
          <h2 className="text-lg font-bold">Hero banner</h2>
          {page.heroImage && (
            <div className="overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={page.heroImage} alt="" className="h-40 w-full object-cover" />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Hero image</label>
              <input type="file" name="heroImageFile" accept="image/*" className="input" />
              <p className="mt-1 text-xs text-muted">Uploaded images are automatically compressed to a tiny WebP.</p>
            </div>
            {page.heroImage && (
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" name="removeHero" className="h-4 w-4 accent-[var(--brand)]" />
                Remove current image
              </label>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Hero heading</label>
              <input name="heroHeading" defaultValue={page.heroHeading ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Hero subheading</label>
              <input name="heroSub" defaultValue={page.heroSub ?? ""} className="input" />
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">Content</h2>
          <p className="text-xs text-muted">
            Supports Markdown — <code>## Heading</code>, <code>### Subheading</code>,
            <code>**bold**</code>, and <code>- list</code> items.
          </p>
          <textarea name="body" defaultValue={page.body} rows={16} className="input font-mono text-sm" />
        </section>

        {/* Settings */}
        <section className="card space-y-4">
          <h2 className="text-lg font-bold">Page settings</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Menu label</label>
              <input name="navLabel" defaultValue={page.navLabel} className="input" />
            </div>
            <div>
              <label className="label">Page title</label>
              <input name="title" defaultValue={page.title} className="input" />
            </div>
            <div>
              <label className="label">Menu order</label>
              <input name="navOrder" type="number" defaultValue={page.navOrder} className="input" />
            </div>
          </div>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="published" defaultChecked={page.published} className="h-4 w-4 accent-[var(--brand)]" />
              Published (visible on site)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="showInNav" defaultChecked={page.showInNav} className="h-4 w-4 accent-[var(--brand)]" />
              Show in menu
            </label>
          </div>
        </section>

        {/* SEO */}
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">SEO</h2>
          </div>
          <div>
            <label className="label">Meta title</label>
            <input name="metaTitle" defaultValue={page.metaTitle ?? ""} maxLength={70} className="input" />
          </div>
          <div>
            <label className="label">Meta description</label>
            <textarea name="metaDescription" defaultValue={page.metaDescription ?? ""} maxLength={165} rows={3} className="input" />
            <p className="mt-1 text-xs text-muted">Aim for ~155 characters. Use the AI button to generate these.</p>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary px-6">
            <Icon name="check" className="h-4 w-4" /> Save changes
          </button>
        </div>
      </form>

      {/* AI SEO (separate form so it doesn't submit the editor) */}
      <form action={generateSeo.bind(null, slug)} className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon name="sparkles" className="h-5 w-5 text-accent" />
          <div>
            <p className="font-bold">AI SEO assistant</p>
            <p className="text-sm text-muted">Writes a meta title &amp; description from this page&apos;s content, then saves it.</p>
          </div>
        </div>
        <button className="btn-accent">
          <Icon name="sparkles" className="h-4 w-4" /> Generate SEO
        </button>
      </form>

      {/* Danger zone */}
      {slug !== "home" && (
        <form action={deletePage.bind(null, slug)} className="flex justify-end">
          <button className="text-sm font-semibold text-danger hover:underline">
            Delete this page
          </button>
        </form>
      )}
    </div>
  );
}
