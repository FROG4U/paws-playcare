import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
// clean
for (const e of ["rollA@example.com","rollB@example.com"]) await prisma.user.deleteMany({ where: { email: e } });

const mkWalks = (bookingId, clientId, dates) => dates.map(d => ({
  bookingId, clientId, date: new Date(d+"T00:00:00Z"), timeSlot:"AM", serviceName:"Field Play", numDogs:1, status:"REQUESTED", price:1600 }));

// Client A — active, not paused. Ongoing booking with only 2 upcoming Tuesdays.
const a = await prisma.user.create({ data: { email:"rollA@example.com", name:"Roll A", passwordHash:"x", role:"CLIENT", status:"ACTIVE", payCadence:"WEEKLY", servicesPaused:false }});
const bookingA = await prisma.booking.create({ data: { clientId:a.id, serviceName:"Field Play", type:"RECURRING", status:"ACTIVE", endDate:null, startDate:new Date("2026-08-11T00:00:00Z"), numDogs:1, dogIds:"[]", daysOfWeek:"[2]", timeSlot:"AM", reviewedAt:new Date(), decision:"ACCEPTED" }});
await prisma.walk.createMany({ data: mkWalks(bookingA.id, a.id, ["2026-08-11","2026-08-18"]) });
// A PAUSED booking for client A — should be skipped (status).
const bookingPaused = await prisma.booking.create({ data: { clientId:a.id, serviceName:"Field Play", type:"RECURRING", status:"PAUSED", endDate:null, startDate:new Date("2026-08-12T00:00:00Z"), numDogs:1, dogIds:"[]", daysOfWeek:"[3]", timeSlot:"AM" }});

// Client B — self-paused. Ongoing booking — should be skipped.
const b = await prisma.user.create({ data: { email:"rollB@example.com", name:"Roll B", passwordHash:"x", role:"CLIENT", status:"ACTIVE", payCadence:"WEEKLY", servicesPaused:true }});
const bookingB = await prisma.booking.create({ data: { clientId:b.id, serviceName:"Field Play", type:"RECURRING", status:"ACTIVE", endDate:null, startDate:new Date("2026-08-11T00:00:00Z"), numDogs:1, dogIds:"[]", daysOfWeek:"[2]", timeSlot:"AM" }});
await prisma.walk.createMany({ data: mkWalks(bookingB.id, b.id, ["2026-08-11","2026-08-18"]) });

console.log("BEFORE:",
  "A walks =", await prisma.walk.count({ where:{ bookingId:bookingA.id }}),
  "| PausedBooking walks =", await prisma.walk.count({ where:{ bookingId:bookingPaused.id }}),
  "| B(self-paused) walks =", await prisma.walk.count({ where:{ bookingId:bookingB.id }}));
console.log("IDS", JSON.stringify({ A:bookingA.id, P:bookingPaused.id, B:bookingB.id }));
await prisma.$disconnect();
