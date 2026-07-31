export function ComingSoon({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <div className="card text-muted">
        {note || "This section is being built — check back shortly. 🐾"}
      </div>
    </div>
  );
}
