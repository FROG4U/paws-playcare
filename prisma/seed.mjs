import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Settings singleton (id=1) + public contact details shown in the footer.
  await prisma.setting.upsert({
    where: { id: 1 },
    update: {
      contactEmail: "kitty@pawsplaycare.co.uk",
      contactPhone: "07725176012",
    },
    create: {
      id: 1,
      contactEmail: "kitty@pawsplaycare.co.uk",
      contactPhone: "07725176012",
    },
  });

  // Seed admin (also a worker by default)
  const email = "admin@pawsplaycare.co.uk";
  const passwordHash = await bcrypt.hash("admin1234", 10);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      role: "ADMIN",
      name: "Paws Playcare Admin",
      status: "ACTIVE",
      canWork: true,
      approvedAt: new Date(),
    },
  });

  // Kitty Cole — admin/owner. Password stored as a bcrypt hash only (never
  // plaintext). Role/status enforced on re-seed; password only set on create so
  // a re-seed never resets it.
  await prisma.user.upsert({
    where: { email: "kitty@pawsplaycare.co.uk" },
    update: { role: "ADMIN", status: "ACTIVE", canWork: true },
    create: {
      email: "kitty@pawsplaycare.co.uk",
      passwordHash: "$2b$10$t3oCud/oF6/5Jfj1dWfqgeqIwRXo0zdcOwVTmHsMk7s7320DZFjxi",
      role: "ADMIN",
      name: "Kitty Cole",
      status: "ACTIVE",
      canWork: true,
      approvedAt: new Date(),
    },
  });

  // Demo CLIENT account — for exploring the client side of the app. Approved &
  // active so it can sign in and click around. The password is (re)set on every
  // seed so it is always known: demo1234
  const demoHash = await bcrypt.hash("demo1234", 10);
  const demo = await prisma.user.upsert({
    where: { email: "demo.client@example.com" },
    update: { passwordHash: demoHash, role: "CLIENT", status: "ACTIVE" },
    create: {
      email: "demo.client@example.com",
      passwordHash: demoHash,
      role: "CLIENT",
      name: "Demo Client",
      phone: "07700 900000",
      status: "ACTIVE",
      approvedAt: new Date(),
      agreedTermsAt: new Date(),
      payCadence: "WEEKLY",
      address: "1 Demo Street, Watford",
      emergencyName: "Demo Contact",
      emergencyPhone: "07700 900111",
    },
  });

  // Give the demo client a dog to make the account feel real (only if none yet).
  const demoDogs = await prisma.dog.count({ where: { ownerId: demo.id } });
  if (demoDogs === 0) {
    await prisma.dog.create({
      data: {
        ownerId: demo.id,
        name: "Buddy",
        breed: "Labrador",
        age: "3 years",
        neutered: true,
        healthDetails: "Fit and healthy, no medication.",
        vaccinationsCurrent: true,
        kennelCoughCurrent: true,
        microchipped: true,
        insured: true,
      },
    });
  }

  // Site content: the Prices page is now the "Services" page (sits in the
  // Services nav slot), and the old standalone Services page is removed.
  // No-ops if the pages haven't been seeded yet.
  await prisma.page.updateMany({
    where: { slug: "prices" },
    data: { navLabel: "Services", title: "Services", navOrder: 2 },
  });
  await prisma.page.deleteMany({ where: { slug: "our-services" } });

  console.log(
    "Seeded admin + Kitty + demo client (demo.client@example.com / demo1234) and applied content"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
