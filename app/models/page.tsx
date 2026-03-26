import { LiveModelTests } from "@/app/components/live-model-tests";
import { getFeatureFlags } from "@/lib/feature-flags";
import { getDashboardData } from "@/lib/openclaw-dashboard";

export const dynamic = "force-dynamic";

export default function ModelsPage() {
  const data = getDashboardData();
  const featureFlags = getFeatureFlags();

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card-strong)] p-6">
        <h2 className="text-2xl font-semibold">Models</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Providers, known model references, and real live probes from your local OpenClaw installation.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {data.providers.map((provider) => (
          <article key={provider.id} className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-semibold">{provider.id}</h3>
                <p className="text-sm text-[var(--text-muted)]">API: {provider.api || "unknown"}</p>
              </div>
              <p className="text-sm text-[var(--text-muted)]">used by: {provider.usedBy.join(", ") || "nobody"}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {provider.models.map((model) => (
                <span key={model.id} className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 text-sm">
                  {model.name}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <LiveModelTests enabled={featureFlags.enableActiveModelTests} />
    </main>
  );
}
