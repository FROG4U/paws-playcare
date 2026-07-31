import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

// Consistent page title block with an icon chip.
export function PageHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Icon name={icon} className="h-[1.35rem] w-[1.35rem]" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

type Tone = "brand" | "amber" | "green" | "danger";
const TONES: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  amber: "bg-warn/15 text-warn",
  green: "bg-success/15 text-success",
  danger: "bg-danger/10 text-danger",
};

// Icon + label + value tile for dashboards.
export function StatCard({
  icon,
  label,
  value,
  href,
  tone = "brand",
  highlight,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  href?: string;
  tone?: Tone;
  highlight?: boolean;
}) {
  const inner = (
    <div
      className={`card flex items-center gap-3.5 transition ${
        href ? "hover:shadow-md hover:border-brand/30" : ""
      } ${highlight ? "ring-2 ring-brand/30" : ""}`}
    >
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${TONES[tone]}`}>
        <Icon name={icon} className="h-[1.3rem] w-[1.3rem]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-muted">{label}</p>
        <p className="text-2xl font-extrabold leading-tight">{value}</p>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// Friendly empty / placeholder state.
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 py-12 text-center">
      <span className="mb-1 grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <p className="font-bold">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
