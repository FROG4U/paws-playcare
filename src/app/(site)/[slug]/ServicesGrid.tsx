import { Icon } from "@/components/Icon";

// The services from the current pawsplaycare.co.uk "Our Services" page,
// presented as classy keyline-icon cards.
const SERVICES = [
  { icon: "clock", title: "Puppy pop-ins", sub: "Brief visits for young puppies needing frequent attention and socialisation." },
  { icon: "users", title: "Social group walks", sub: "One-hour group walks bringing dogs together for exercise and interaction." },
  { icon: "mapPin", title: "Adventure walks", sub: "Longer 1.5-hour outings for dogs needing more vigorous activity and exploration." },
  { icon: "footprints", title: "Play & walk sessions", sub: "A comprehensive 3-hour experience combining playtime with walking." },
  { icon: "car", title: "Pet taxi service", sub: "Pick up and drop off included for convenient pet transport." },
  { icon: "check", title: "Dog training", sub: "Professional training to support behavioural development and obedience." },
  { icon: "gift", title: "Pet food delivery", sub: "A convenient shopping service with pickup and home delivery of pet food." },
];

export function ServicesGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SERVICES.map((s) => (
        <div key={s.title} className="card flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Icon name={s.icon} className="h-6 w-6" />
          </span>
          <div>
            <h3 className="font-extrabold text-foreground">{s.title}</h3>
            <p className="mt-1 text-sm text-muted">{s.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
