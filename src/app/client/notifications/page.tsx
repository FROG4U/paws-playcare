import { requireClient } from "@/lib/guard";
import { NotificationsList } from "@/components/NotificationsList";

export default async function ClientNotifications() {
  const user = await requireClient();
  return <NotificationsList userId={user.id} basePath="/client/notifications" title="Messages" />;
}
