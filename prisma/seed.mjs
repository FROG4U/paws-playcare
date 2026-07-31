import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Default pricing/settings (singleton row id=1)
  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
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

  console.log("Seeded settings + admin (admin@pawsplaycare.co.uk / admin1234)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
