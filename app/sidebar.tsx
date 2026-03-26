import { SidebarNav } from "./sidebar-nav";

export function Sidebar() {
  return (
    <aside className="sidebar-shell w-full shrink-0 border-b md:min-h-screen md:w-72 md:border-b-0">
      <div className="sticky top-0 p-4 md:p-6">
        <div className="rounded-[26px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--text-muted)]">ClawDash</p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--text)]">OpenClaw Control</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Dark local dashboard for OpenClaw agents, sessions, stats, office, and CLI tools.
            </p>
          </div>

          <SidebarNav />

          <div className="mt-6 rounded-[18px] border border-[var(--border)] bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">Scope</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Active checks, layout writes, and external fetches are intentionally separated.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
