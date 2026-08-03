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

  // Site content: the Prices page is now the "Services" page (sits in the
  // Services nav slot), and the old standalone Services page is removed.
  // No-ops if the pages haven't been seeded yet.
  await prisma.page.updateMany({
    where: { slug: "prices" },
    data: { navLabel: "Services", title: "Services", navOrder: 2 },
  });
  await prisma.page.deleteMany({ where: { slug: "our-services" } });

  console.log(
    "Seeded admin + applied contact details and Services/Prices merge"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
