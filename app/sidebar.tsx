"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "◫" },
  { href: "/operator", label: "Operator", icon: "⌁" },
  { href: "/cli", label: "CLI", icon: ">_" },
  { href: "/pixel-office", label: "Pixel Office", icon: "⌘" },
  { href: "/models", label: "Models", icon: "◇" },
  { href: "/sessions", label: "Sessions", icon: "◎" },
  { href: "/stats", label: "Stats", icon: "▥" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar-shell w-full shrink-0 border-b md:min-h-screen md:w-72 md:border-b-0">
      <div className="sticky top-0 p-4 md:p-6">
        <div className="rounded-[26px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--text-muted)]">ClawDash</p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--text)]">OpenClaw Übersicht</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Dunkles Dashboard für lokale OpenClaw-Agents, Sessions, Stats und Office.
            </p>
          </div>

          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-[18px] border px-4 py-3 text-sm transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                      : "border-[var(--border)] bg-[rgba(255,255,255,0.02)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                  }`}
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-current/20 bg-black/10 text-base">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 rounded-[18px] border border-[var(--border)] bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">Performance</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Modelltests, Layout-Writes und externe Fetches sind bewusst scharf getrennt.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
