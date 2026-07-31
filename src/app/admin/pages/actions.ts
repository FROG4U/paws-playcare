"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { saveCompressedImage, deleteUpload } from "@/lib/upload";

function refreshPublic(slug: string) {
  revalidatePath("/admin/pages");
  revalidatePath("/");
  revalidatePath(`/${slug}`);
  revalidatePath("/", "layout"); // nav/footer
}

export async function saveSiteInfo(formData: FormData) {
  await requireRole([ROLES.ADMIN]);
  const str = (k: string) => String(formData.get(k) || "").trim();
  await prisma.setting.update({
    where: { id: 1 },
    data: {
      siteName: str("siteName") || "Paws Playcare",
      tagline: str("tagline"),
      contactEmail: str("contactEmail"),
      contactPhone: str("contactPhone"),
      address: str("address"),
      facebookUrl: str("facebookUrl"),
      instagramUrl: str("instagramUrl"),
    },
  });
  revalidatePath("/admin/pages");
  revalidatePath("/", "layout");
}

export async function savePage(formData: FormData) {
  await requireRole([ROLES.ADMIN]);
  const slug = String(formData.get("slug") || "");
  const page = await prisma.page.findUnique({ where: { slug } });
  if (!page) return;

  const str = (k: string) => String(formData.get(k) || "").trim();

  // Hero image: upload a new one (compressed), remove, or keep existing.
  let heroImage: string | null = page.heroImage;
  const file = formData.get("heroImageFile");
  if (file instanceof File && file.size > 0) {
    heroImage = await saveCompressedImage(file);
    await deleteUpload(page.heroImage);
  } else if (formData.get("removeHero") === "on") {
    await deleteUpload(page.heroImage);
    heroImage = null;
  }

  await prisma.page.update({
    where: { slug },
    data: {
      navLabel: str("navLabel") || page.navLabel,
      title: str("title") || page.title,
      heroHeading: str("heroHeading") || null,
      heroSub: str("heroSub") || null,
      body: String(formData.get("body") || ""),
      metaTitle: str("metaTitle") || null,
      metaDescription: str("metaDescription") || null,
      heroImage,
      showInNav: formData.get("showInNav") === "on",
      published: formData.get("published") === "on",
      navOrder: Number(formData.get("navOrder") || page.navOrder),
    },
  });
  refreshPublic(slug);
  redirect("/admin/pages?saved=1");
}

// AI-assisted SEO. Uses the Anthropic API when ANTHROPIC_API_KEY is set,
// otherwise falls back to a solid heuristic so it always does something useful.
export async function generateSeo(slug: string) {
  await requireRole([ROLES.ADMIN]);
  const page = await prisma.page.findUnique({ where: { slug } });
  if (!page) return;

  const plain = page.body.replace(/[#*_>`\-]/g, " ").replace(/\s+/g, " ").trim();
  let metaTitle = `${page.title} — Paws Playcare Watford`;
  let metaDescription = plain.slice(0, 155).trim();

  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `You write SEO metadata for a Watford dog-walking business called Paws Playcare. For the page titled "${page.title}", write a compelling SEO meta title (max 60 chars) and meta description (max 155 chars). Page content:\n\n${plain.slice(0, 1500)}\n\nReturn ONLY JSON: {"metaTitle":"...","metaDescription":"..."}`,
            },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.content?.[0]?.text ?? "";
        const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        if (json.metaTitle) metaTitle = String(json.metaTitle).slice(0, 65);
        if (json.metaDescription) metaDescription = String(json.metaDescription).slice(0, 160);
      }
    } catch {
      // fall back to heuristic
    }
  }

  await prisma.page.update({
    where: { slug },
    data: { metaTitle, metaDescription },
  });
  revalidatePath(`/admin/pages/${slug}/edit`);
}

export async function createPage(formData: FormData) {
  await requireRole([ROLES.ADMIN]);
  const raw = String(formData.get("slug") || "").trim().toLowerCase();
  const slug = raw.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const title = String(formData.get("title") || "").trim();
  if (!slug || !title) return;
  const exists = await prisma.page.findUnique({ where: { slug } });
  if (exists) redirect(`/admin/pages/${slug}/edit`);
  const max = await prisma.page.aggregate({ _max: { navOrder: true } });
  await prisma.page.create({
    data: { slug, title, navLabel: title, navOrder: (max._max.navOrder ?? 0) + 1, heroHeading: title },
  });
  redirect(`/admin/pages/${slug}/edit`);
}

export async function deletePage(slug: string) {
  await requireRole([ROLES.ADMIN]);
  const page = await prisma.page.findUnique({ where: { slug } });
  if (page) await deleteUpload(page.heroImage);
  await prisma.page.delete({ where: { slug } });
  refreshPublic(slug);
  redirect("/admin/pages");
}
