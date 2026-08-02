import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { EditClientForm } from "./EditClientForm";
import { EditDogForm } from "./EditDogForm";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.user.findUnique({
    where: { id },
    include: { dogs: { orderBy: { createdAt: "asc" } } },
  });
  if (!client || client.role !== ROLES.CLIENT) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/clients/${client.id}`} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-brand-soft" aria-label="Back">
          <Icon name="chevronRight" className="h-5 w-5 rotate-180" />
        </Link>
        <PageHeader icon="pencil" title={`Edit ${client.name}`} subtitle="Update the client and their dogs' details." />
      </div>

      <EditClientForm
        client={{
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          address: client.address,
          emergencyName: client.emergencyName,
          emergencyPhone: client.emergencyPhone,
          payCadence: client.payCadence,
          notes: client.notes,
        }}
      />

      {client.dogs.map((dog) => (
        <EditDogForm key={dog.id} dog={dog} clientId={client.id} />
      ))}
    </div>
  );
}
