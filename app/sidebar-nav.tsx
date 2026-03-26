"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "◫" },
  { href: "/operator", label: "Operator", icon: "⌁" },
  { href: "/settings", label: "Settings", icon: "⚙" },
  { href: "/cli", label: "CLI", icon: ">_" },
  { href: "/pixel-office", label: "Pixel Office", icon: "⌘" },
  { href: "/models", label: "Models", icon: "◇" },
  { href: "/sessions", label: "Sessions", icon: "◎" },
  { href: "/stats", label: "Stats", icon: "▥" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
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
  );
}
