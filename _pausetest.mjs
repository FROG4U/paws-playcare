import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
await prisma.user.deleteMany({ where: { email: "pausetest@example.com" } });
const c = await prisma.user.create({ data: {
  email:"pausetest@example.com", name:"Pause Test", passwordHash:"x", role:"CLIENT", status:"ACTIVE",
  payCadence:"WEEKLY", pauseRequestedAt: new Date(), pauseRequestReason: "Away for 2 weeks",
}});
const bk = await prisma.booking.create({ data: {
  clientId:c.id, serviceName:"Field Play", type:"RECURRING", status:"ACTIVE", endDate:null,
  startDate:new Date("2026-08-18T00:00:00Z"), numDogs:1, dogIds:"[]", daysOfWeek:"[2]", timeSlot:"AM", reviewedAt:new Date(), decision:"ACCEPTED",
}});
for (const d of ["2026-08-18","2026-08-25","2026-09-01"]) await prisma.walk.create({ data: {
  bookingId:bk.id, clientId:c.id, date:new Date(d+"T00:00:00Z"), timeSlot:"AM", serviceName:"Field Play", numDogs:1, status:"REQUESTED", price:1600 }});
console.log("clientId:", c.id, "| walks:", await prisma.walk.count({ where:{ clientId:c.id }}));
await prisma.$disconnect();
