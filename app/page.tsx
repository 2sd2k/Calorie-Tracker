import {
  aggregateByDay,
  aggregateWeightByDay,
  fetchMeals,
  fetchWeights,
  getTodayDate,
  isConfigured,
  weightConfigured,
  type NotionError,
} from "@/lib/notion";
import { CaloriesChart, MacrosChart } from "@/components/MacroCharts";
import { WeightChart } from "@/components/WeightChart";

// Always reflect the latest Notion data on load.
export const dynamic = "force-dynamic";

function StatCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-[var(--muted)]">{unit}</span>}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="mb-4 text-sm font-semibold text-[var(--muted)]">{title}</h2>
      {children}
    </section>
  );
}

function SetupNotice() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold">🍽️ Macro Tracker</h1>
      <p className="mt-3 text-[var(--muted)]">
        Almost there — connect the app to your Notion database to see your graphs.
      </p>
      <ol className="mt-6 space-y-3 text-sm leading-relaxed">
        <li>
          1. Create an internal integration at{" "}
          <a className="underline" href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer">
            notion.so/my-integrations
          </a>{" "}
          and copy its token.
        </li>
        <li>2. Open your <strong>Meals Log</strong> database → <em>•••</em> → <em>Connections</em> → add the integration.</li>
        <li>
          3. Add <code className="rounded bg-black/10 px-1">NOTION_TOKEN</code> and{" "}
          <code className="rounded bg-black/10 px-1">NOTION_DATA_SOURCE_ID</code> to{" "}
          <code className="rounded bg-black/10 px-1">.env.local</code> (see <code>.env.example</code>), then restart.
        </li>
      </ol>
    </main>
  );
}

function DataError({ error }: { error: NotionError }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold">🍽️ Macro Tracker</h1>
      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-red-500">
          Couldn’t load your data
        </div>
        <h2 className="mt-1 text-lg font-semibold">{error.title}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{error.detail}</p>
        {error.hint && (
          <p className="mt-3 rounded-lg bg-black/5 p-3 text-sm leading-relaxed dark:bg-white/5">
            {error.hint}
          </p>
        )}
      </div>
    </main>
  );
}

export default async function Home() {
  if (!isConfigured) return <SetupNotice />;

  const result = await fetchMeals();
  if (!result.ok) return <DataError error={result.error} />;

  const meals = result.meals;
  const daily = aggregateByDay(meals);

  const today = getTodayDate();
  const todayRow = daily.find((d) => d.date === today);
  const daysLogged = daily.length;
  const avgCalories = daysLogged
    ? Math.round(daily.reduce((s, d) => s + d.calories, 0) / daysLogged)
    : 0;
  const avgProtein = daysLogged
    ? Math.round(daily.reduce((s, d) => s + d.protein, 0) / daysLogged)
    : 0;

  const recent = [...meals].reverse().slice(0, 8);

  // Weight is an optional, separate database — fetch it only if configured.
  const weightRes = weightConfigured ? await fetchWeights() : null;
  const weightDaily = weightRes?.ok ? aggregateWeightByDay(weightRes.entries) : [];
  const latestWeight = weightDaily.at(-1)?.weight ?? null;
  const firstWeight = weightDaily[0]?.weight ?? null;
  const weightChange =
    latestWeight !== null && firstWeight !== null
      ? Math.round((latestWeight - firstWeight) * 10) / 10
      : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">🍽️ Macro Tracker</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Pulled live from your Notion Meals Log · {meals.length} meals across {daysLogged} days
        </p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Today" value={todayRow ? String(todayRow.calories) : "—"} unit="cal" />
        <StatCard label="Today Protein" value={todayRow ? String(todayRow.protein) : "—"} unit="g" />
        <StatCard label="Avg / day" value={String(avgCalories)} unit="cal" />
        <StatCard label="Avg Protein" value={String(avgProtein)} unit="g" />
      </div>

      <div className="grid gap-6">
        {/* Weight — renders on its own, independent of whether meals exist. */}
        {weightConfigured && weightRes && !weightRes.ok && (
          <Panel title="Weight (lbs)">
            <p className="text-sm text-[var(--muted)]">
              {weightRes.error.title}. {weightRes.error.hint}
            </p>
          </Panel>
        )}

        {weightDaily.length > 0 && (
          <Panel title="Weight (lbs)">
            <div className="mb-3 flex items-baseline gap-3">
              <span className="text-2xl font-semibold">
                {latestWeight}
                <span className="ml-1 text-sm font-normal text-[var(--muted)]">lbs</span>
              </span>
              {weightChange !== null && weightDaily.length > 1 && (
                <span className="text-sm text-[var(--muted)]">
                  {weightChange > 0 ? "+" : ""}
                  {weightChange} lbs over {weightDaily.length} days
                </span>
              )}
            </div>
            <WeightChart data={weightDaily} />
          </Panel>
        )}

        {weightConfigured && weightRes?.ok && weightDaily.length === 0 && (
          <Panel title="Weight (lbs)">
            <p className="text-sm text-[var(--muted)]">
              Log a weigh-in in your Weight Log (set the <strong>Date</strong> and{" "}
              <strong>Weight (lbs)</strong>) and refresh.
            </p>
          </Panel>
        )}

        {/* Meals */}
        {daysLogged === 0 ? (
          <Panel title="No meals logged yet">
            <p className="text-sm text-[var(--muted)]">
              Log a meal in your Meals Log (set the <strong>Date</strong> and macro fields) and refresh.
            </p>
          </Panel>
        ) : (
          <>
            <Panel title="Calories per day">
              <CaloriesChart data={daily} />
            </Panel>
            <Panel title="Macros per day (g)">
              <MacrosChart data={daily} />
            </Panel>
            <Panel title="Recent meals">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-[var(--muted)]">
                    <tr>
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Meal</th>
                      <th className="py-2 pr-4 text-right">Cal</th>
                      <th className="py-2 pr-4 text-right">P</th>
                      <th className="py-2 pr-4 text-right">C</th>
                      <th className="py-2 text-right">F</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((m) => (
                      <tr key={m.id} className="border-t border-[var(--border)]">
                        <td className="py-2 pr-4 text-[var(--muted)]">{m.date ?? "—"}</td>
                        <td className="py-2 pr-4">{m.name || "Untitled"}</td>
                        <td className="py-2 pr-4 text-right">{m.calories}</td>
                        <td className="py-2 pr-4 text-right">{m.protein}</td>
                        <td className="py-2 pr-4 text-right">{m.carbs}</td>
                        <td className="py-2 text-right">{m.fat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </div>
    </main>
  );
}
