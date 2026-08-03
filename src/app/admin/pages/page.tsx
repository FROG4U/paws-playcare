import Link from "next/link";
import { getPages } from "@/lib/pages";
import { getSettings } from "@/lib/pricing";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { saveSiteInfo, createPage } from "./actions";
import { TestEmailButton } from "./TestEmailButton";

export default async function PagesAdmin({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const [pages, s] = await Promise.all([getPages(), getSettings()]);

  return (
    <div className="space-y-6">
      <PageHeader icon="clipboard" title="Pages" subtitle="Edit your public website — content, hero banners and SEO." />

      {saved && (
        <p className="flex items-center gap-2 rounded-lg bg-success/15 px-3 py-2 text-sm text-success">
          <Icon name="check" className="h-4 w-4" /> Saved. Your public site is updated.
        </p>
      )}

      {/* Pages list */}
      <div className="grid gap-3">
        {pages.map((p) => (
          <div key={p.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-soft text-brand">
                {p.heroImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.heroImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Icon name="clipboard" className="h-5 w-5" />
                )}
              </span>
              <div>
                <p className="font-bold">
                  {p.title}
                  {!p.published && <span className="ml-2 badge bg-border text-muted">draft</span>}
                  {!p.showInNav && <span className="ml-1 badge bg-border text-muted">hidden</span>}
                </p>
                <p className="text-sm text-muted">/{p.slug === "home" ? "" : p.slug}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={p.slug === "home" ? "/" : `/${p.slug}`} target="_blank" className="btn-ghost">
                <Icon name="arrowRight" className="h-4 w-4" /> View
              </Link>
              <Link href={`/admin/pages/${p.slug}/edit`} className="btn-outline">
                <Icon name="pencil" className="h-4 w-4" /> Edit
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Add a page */}
      <details className="card">
        <summary className="cursor-pointer font-bold">Add a new page</summary>
        <form action={createPage} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Page title</label>
            <input name="title" required className="input" placeholder="e.g. Reviews" />
          </div>
          <div>
            <label className="label">URL slug</label>
            <input name="slug" required className="input" placeholder="reviews" />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-accent">Create page</button>
          </div>
        </form>
      </details>

      {/* Site info (footer / contact) */}
      <form action={saveSiteInfo} className="card space-y-4">
        <div className="flex items-center gap-2">
          <Icon name="home" className="h-5 w-5 text-brand" />
          <h2 className="text-lg font-bold">Site info</h2>
        </div>
        <p className="text-sm text-muted">Shown in the website footer and contact page.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="siteName" label="Site name" value={s.siteName} />
          <Field name="tagline" label="Tagline" value={s.tagline} />
          <Field name="contactEmail" label="Contact email" value={s.contactEmail} type="email" />
          <Field name="contactPhone" label="Contact phone" value={s.contactPhone} />
          <Field name="address" label="Address / area" value={s.address} />
          <Field name="facebookUrl" label="Facebook URL" value={s.facebookUrl} />
          <Field name="instagramUrl" label="Instagram URL" value={s.instagramUrl} />
        </div>
        <button className="btn-primary">Save site info</button>
      </form>

      <TestEmailButton defaultTo={s.contactEmail || ""} />
    </div>
  );
}

function Field({
  name,
  label,
  value,
  type = "text",
}: {
  name: string;
  label: string;
  value: string;
  type?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} defaultValue={value} type={type} className="input" />
    </div>
  );
}
