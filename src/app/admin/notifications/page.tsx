import { requireAdmin } from "@/lib/guard";
import { NotificationsList } from "@/components/NotificationsList";

export default async function AdminNotifications() {
  const user = await requireAdmin();
  return (
    <NotificationsList userId={user.id} basePath="/admin/notifications" />
  );
}
