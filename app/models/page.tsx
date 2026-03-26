import { LiveModelTests } from "@/app/components/live-model-tests";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { getDashboardData } from "@/lib/openclaw-dashboard";

export default function ModelsPage() {
  const data = getDashboardData();

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card-strong)] p-6">
        <h2 className="text-2xl font-semibold">Models</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Provider, bekannte Modellreferenzen und echte Live-Probes über deine lokale OpenClaw-Installation.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {data.providers.map((provider) => (
          <article key={provider.id} className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-semibold">{provider.id}</h3>
                <p className="text-sm text-[var(--text-muted)]">API: {provider.api || "unbekannt"}</p>
              </div>
              <p className="text-sm text-[var(--text-muted)]">genutzt von: {provider.usedBy.join(", ") || "niemandem"}</p>
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

      <LiveModelTests enabled={FEATURE_FLAGS.enableActiveModelTests} />
    </main>
  );
}
