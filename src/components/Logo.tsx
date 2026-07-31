export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
        <svg viewBox="0 0 512 512" className="h-5 w-5" fill="currentColor">
          <circle cx="256" cy="300" r="70" />
          <circle cx="150" cy="230" r="38" />
          <circle cx="215" cy="165" r="38" />
          <circle cx="297" cy="165" r="38" />
          <circle cx="362" cy="230" r="38" />
        </svg>
      </span>
      <span className="tracking-tight">
        Paws <span className="text-brand">Playcare</span>
      </span>
    </span>
  );
}
