import { prisma } from "@/lib/prisma";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: true });

// The public marketing pages, seeded once with content mirrored from the
// current pawsplaycare.co.uk site. Everything is editable in admin → Pages.
const DEFAULT_PAGES = [
  {
    slug: "home",
    heroImage: "/brand/hero-home.webp",
    navLabel: "Home",
    title: "Paws Playcare Watford",
    heroHeading: "Walk and play makes a dog's day!",
    heroSub: "What we say is what we do — lots of walking and playing too. Pickup and drop-off included.",
    navOrder: 0,
    metaTitle: "Paws Playcare Watford — Dog Walking & Play",
    metaDescription: "Friendly, fully-insured dog walking and play in Watford. Social group walks, adventure walks and a private enclosed paddock. Pickup and drop-off included.",
    body: `## Welcome to Paws Playcare Watford

Walk and play makes a dog's day! What we say is what we do — lots of walking and playing too. Transportation is included with pickup and drop-off.`,
  },
  {
    slug: "about-us",
    heroImage: "/brand/hero-grace.webp",
    navLabel: "About us",
    title: "About us",
    heroHeading: "A little about me",
    heroSub: "A lifelong dedication to animal welfare.",
    navOrder: 1,
    metaTitle: "About us — Paws Playcare Watford",
    metaDescription: "Meet the founder of Paws Playcare Watford — a lifelong animal lover, RSPCA volunteer, qualified teacher and swim instructor.",
    body: `## A little about me

I've a lifelong dedication to animal welfare. At home I have three cats and a German Shepherd Dog.

My commitment to animal care extends to volunteer work with the RSPCA, where I regularly walk dogs, interact with cats and socialise all kinds of animals. This hands-on experience keeps me up to date with current pet health recommendations and vaccination protocols. It's rewarding work — especially seeing animals thrive and move on to their new homes.

Away from animals I keep active through running, swimming and hockey. I trained as a primary school teacher and swim instructor, though I'm now "retired" from those roles.`,
  },
  {
    slug: "playground",
    heroImage: "/brand/hero-grace.webp",
    navLabel: "Playground",
    title: "Our playground",
    heroHeading: "Paws Playcare's doggy playground",
    heroSub: "Around two acres across three enclosed areas.",
    navOrder: 3,
    metaTitle: "Playground — Paws Playcare Watford",
    metaDescription: "Private hire of our two-acre doggy playground in Watford — three separate enclosed areas for group or individual sessions.",
    body: `## Our doggy playground

Private hire of the facility is available for both group bookings and individual dog or family sessions.

The playground is made up of three separate areas totalling around two acres, each offering something different to explore. This multi-section design gives dogs varied play experiences across the grounds.

Bookings can often be arranged on the day depending on availability — just use the online booking form.`,
  },
  {
    slug: "prices",
    heroImage: "/brand/hero-home.webp",
    navLabel: "Services",
    title: "Services",
    heroHeading: "Simple, fair pricing",
    heroSub: "Priced per dog, with clear rates.",
    navOrder: 2,
    metaTitle: "Prices — Paws Playcare Watford",
    metaDescription: "Clear per-dog pricing for dog walking and play in Watford. Bank holidays and weekends are handled fairly.",
    body: `## Our prices

Our live rates are shown below. Weekends and bank holidays are always closed, and any repeating booking that lands on a bank holiday is skipped automatically.

Create an account to book — payment is collected automatically after each completed walk on your chosen schedule.`,
  },
  {
    slug: "contact",
    heroImage: "/brand/hero-grace.webp",
    navLabel: "Contact",
    title: "Contact us",
    heroHeading: "Get in touch",
    heroSub: "We'd love to hear from you and your dog.",
    navOrder: 5,
    metaTitle: "Contact us — Paws Playcare Watford",
    metaDescription: "Contact Paws Playcare Watford about dog walking, play sessions and playground hire.",
    body: `## Contact us

Have a question about walks, play sessions or playground hire? Send us a message using the form below and we'll get back to you.`,
  },
];

export async function getPages() {
  const count = await prisma.page.count();
  if (count === 0) {
    await prisma.page.createMany({ data: DEFAULT_PAGES });
  }
  return prisma.page.findMany({ orderBy: { navOrder: "asc" } });
}

export async function getNavPages() {
  await getPages(); // ensure seeded
  return prisma.page.findMany({
    where: { published: true, showInNav: true },
    orderBy: { navOrder: "asc" },
    select: { slug: true, navLabel: true },
  });
}

export async function getPage(slug: string) {
  await getPages(); // ensure seeded
  return prisma.page.findUnique({ where: { slug } });
}

export function renderMarkdown(body: string): string {
  return marked.parse(body || "", { async: false }) as string;
}
