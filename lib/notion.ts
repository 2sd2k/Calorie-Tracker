import {
  APIErrorCode,
  Client,
  ClientErrorCode,
  isFullPage,
  isNotionClientError,
} from "@notionhq/client";

/**
 * One meal row, as logged in the Notion "Meals Log" database.
 */
export type Meal = {
  id: string;
  name: string;
  date: string | null; // ISO date, e.g. "2026-06-13"
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes: string;
};

/**
 * Macros summed across all meals logged on a single day.
 * This is one point on the progression graph.
 */
export type DailyTotals = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: number;
};

/**
 * A classified, human-actionable failure from the Notion side of things.
 * We return these as values (rather than throwing) so the dashboard can show
 * the *specific* fix — even in production, where thrown Server Component errors
 * are sanitized to a generic message with a digest.
 */
export type NotionError = {
  kind: "config" | "auth" | "access" | "schema" | "rate_limited" | "unavailable";
  title: string;
  detail: string;
  hint?: string;
};

export type FetchMealsResult =
  | { ok: true; meals: Meal[] }
  | { ok: false; error: NotionError };

const token = process.env.NOTION_TOKEN;
const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;

export const isConfigured = Boolean(token && dataSourceId);

const notion = token ? new Client({ auth: token }) : null;

// Notion property values are loosely typed; narrow them where we read.
/* eslint-disable @typescript-eslint/no-explicit-any */
function num(prop: any): number {
  return typeof prop?.number === "number" ? prop.number : 0;
}

function plainText(rich: any[] | undefined): string {
  if (!Array.isArray(rich)) return "";
  return rich.map((r) => r?.plain_text ?? "").join("");
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The columns the dashboard reads, with the Notion property type each must be.
 * Names are case-sensitive and must match the database exactly.
 */
const REQUIRED_PROPS = [
  { name: "Meal", type: "title" },
  { name: "Date", type: "date" },
  { name: "Calories", type: "number" },
  { name: "Protein (g)", type: "number" },
  { name: "Carbs (g)", type: "number" },
  { name: "Fat (g)", type: "number" },
] as const;

/**
 * Compare a page's properties against what we expect. Returns a schema error
 * describing every mismatch, or null if the shape is good. This is what turns a
 * silent column of zeros (from a renamed or re-typed field) into a loud, fixable
 * message. Every row in a Notion database shares the same schema, so checking
 * one representative page is enough.
 */
function validateSchema(
  props: Record<string, { type?: string } | undefined>,
): NotionError | null {
  const problems: string[] = [];
  for (const { name, type } of REQUIRED_PROPS) {
    const prop = props[name];
    if (!prop) problems.push(`missing "${name}" (${type})`);
    else if (prop.type !== type)
      problems.push(`"${name}" should be ${type}, but it's ${prop.type}`);
  }
  if (problems.length === 0) return null;
  return {
    kind: "schema",
    title: "Your Notion columns don't line up",
    detail: `The dashboard couldn't read every column it needs: ${problems.join("; ")}.`,
    hint: 'Rename the columns in your Meals Log to match exactly (case-sensitive), including the "(g)" suffix on Protein/Carbs/Fat.',
  };
}

/**
 * Map a thrown Notion error to an actionable message. Returns null for anything
 * we don't specifically recognize, so the caller can rethrow it to the error
 * boundary rather than swallow a real bug.
 */
function classifyError(err: unknown): NotionError | null {
  if (!isNotionClientError(err)) return null;
  switch (err.code) {
    case APIErrorCode.Unauthorized:
      return {
        kind: "auth",
        title: "Notion rejected the token",
        detail: "The NOTION_TOKEN wasn't accepted.",
        hint: "Copy a fresh internal integration token from notion.so/my-integrations into .env.local, then restart.",
      };
    case APIErrorCode.RestrictedResource:
    case APIErrorCode.ObjectNotFound:
      return {
        kind: "access",
        title: "Can't reach the Meals Log",
        detail:
          "Either the integration isn't connected to this database, or NOTION_DATA_SOURCE_ID points somewhere else.",
        hint: "In Notion, open the database → ••• → Connections → add your integration, then double-check the data source ID.",
      };
    case APIErrorCode.ValidationError:
    case APIErrorCode.InvalidRequestURL:
    case APIErrorCode.InvalidRequest:
      return {
        kind: "schema",
        title: "Notion couldn't process the request",
        detail: err.message,
        hint: 'This often means the "Date" column was renamed or NOTION_DATA_SOURCE_ID is malformed.',
      };
    case APIErrorCode.RateLimited:
      return {
        kind: "rate_limited",
        title: "Notion is rate-limiting us",
        detail: "Too many requests hit the Notion API in a short window.",
        hint: "Wait a few seconds and refresh.",
      };
    case APIErrorCode.InternalServerError:
    case APIErrorCode.ServiceUnavailable:
    case APIErrorCode.GatewayTimeout:
    case ClientErrorCode.RequestTimeout:
      return {
        kind: "unavailable",
        title: "Notion is unreachable right now",
        detail: "The request failed or timed out before Notion responded.",
        hint: "This is usually temporary — refresh in a moment.",
      };
    default:
      return null;
  }
}

/**
 * Fetch every meal from the Notion data source, following pagination.
 * Expected, actionable failures come back as `{ ok: false, error }`; anything
 * unrecognized is rethrown for the route's error boundary to catch.
 */
export async function fetchMeals(): Promise<FetchMealsResult> {
  if (!notion || !dataSourceId) {
    return {
      ok: false,
      error: {
        kind: "config",
        title: "Not connected to Notion",
        detail: "NOTION_TOKEN and NOTION_DATA_SOURCE_ID must both be set.",
        hint: "Copy .env.example to .env.local and fill in both values, then restart.",
      },
    };
  }

  try {
    const meals: Meal[] = [];
    let cursor: string | undefined = undefined;
    let validated = false;

    do {
      const res = await notion.dataSources.query({
        data_source_id: dataSourceId,
        start_cursor: cursor,
        page_size: 100,
        sorts: [{ property: "Date", direction: "ascending" }],
      });

      for (const page of res.results) {
        // Only full page objects carry properties.
        if (!isFullPage(page)) continue;
        const p = page.properties as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

        // Validate the schema once, against the first real row we see.
        if (!validated) {
          const schemaError = validateSchema(p);
          if (schemaError) return { ok: false, error: schemaError };
          validated = true;
        }

        meals.push({
          id: page.id,
          name: plainText(p["Meal"]?.title),
          date: p["Date"]?.date?.start ?? null,
          calories: num(p["Calories"]),
          protein: num(p["Protein (g)"]),
          carbs: num(p["Carbs (g)"]),
          fat: num(p["Fat (g)"]),
          notes: plainText(p["Notes"]?.rich_text),
        });
      }

      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return { ok: true, meals };
  } catch (err) {
    const classified = classifyError(err);
    if (classified) return { ok: false, error: classified };
    throw err; // unrecognized — let the error boundary handle it
  }
}

/**
 * Roll meals up into one row per day — the data behind the graph.
 */
export function aggregateByDay(meals: Meal[]): DailyTotals[] {
  const byDate = new Map<string, DailyTotals>();

  for (const meal of meals) {
    if (!meal.date) continue;
    const day = meal.date.slice(0, 10); // strip any time component
    const cur =
      byDate.get(day) ??
      { date: day, calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 };

    cur.calories += meal.calories;
    cur.protein += meal.protein;
    cur.carbs += meal.carbs;
    cur.fat += meal.fat;
    cur.meals += 1;
    byDate.set(day, cur);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Today's calendar date as "YYYY-MM-DD", in the tracker's timezone.
 *
 * Notion's "Date" is a calendar day, so "today" must be resolved in a real
 * timezone — never UTC. A server (e.g. Vercel) runs in UTC, which rolls over to
 * tomorrow late in the evening for western timezones and mismatches the day the
 * meal was logged under. Set TRACKER_TIMEZONE (an IANA name like
 * "America/Los_Angeles") in production; locally it falls back to the machine's
 * own timezone.
 */
export function getTodayDate(now: Date = new Date()): string {
  const timeZone =
    process.env.TRACKER_TIMEZONE ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
