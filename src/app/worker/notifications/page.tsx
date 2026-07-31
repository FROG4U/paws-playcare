import { requireWorker } from "@/lib/guard";
import { NotificationsList } from "@/components/NotificationsList";

export default async function WorkerNotifications() {
  const user = await requireWorker();
  return <NotificationsList userId={user.id} basePath="/worker/notifications" />;
}
