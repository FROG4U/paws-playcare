import type { MetadataRoute } from "next";

const base = (process.env.NEXT_PUBLIC_APP_URL || "https://pawsplaycare.co.uk").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/worker", "/client", "/PPC", "/dashboard"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
