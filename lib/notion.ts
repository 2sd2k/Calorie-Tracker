import { Client } from "@notionhq/client";

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
 * Fetch every meal from the Notion data source, following pagination.
 */
export async function fetchMeals(): Promise<Meal[]> {
  if (!notion || !dataSourceId) return [];

  const meals: Meal[] = [];
  let cursor: string | undefined = undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
      sorts: [{ property: "Date", direction: "ascending" }],
    });

    for (const page of res.results) {
      // Only full page objects carry properties.
      if (!("properties" in page)) continue;
      const p = page.properties as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

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

  return meals;
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
