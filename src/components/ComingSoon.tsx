import { PageHeader, EmptyState } from "./ui";

export function ComingSoon({
  title,
  icon = "clipboard",
  note,
}: {
  title: string;
  icon?: string;
  note?: string;
}) {
  return (
    <div className="space-y-5">
      <PageHeader icon={icon} title={title} />
      <EmptyState icon="hourglass" title="Coming soon">
        {note || "This section is being built — check back shortly."}
      </EmptyState>
    </div>
  );
}
