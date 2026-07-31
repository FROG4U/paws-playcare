import type { MetadataRoute } from "next";
import { getPages } from "@/lib/pages";

const base = (process.env.NEXT_PUBLIC_APP_URL || "https://pawsplaycare.co.uk").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await getPages();
  const routes = pages
    .filter((p) => p.published)
    .map((p) => ({
      url: p.slug === "home" ? base : `${base}/${p.slug}`,
      lastModified: p.updatedAt,
    }));
  return [
    ...routes,
    { url: `${base}/online-booking-form`, lastModified: new Date() },
  ];
}
