// Dev helper: insert ~a week of realistic sample meals into the Meals Log so
// the dashboard's charts have something to render. Every row is tagged
// "· sample" in Notes so you can spot and bulk-delete them later.
//
//   node scripts/seed-sample-meals.mjs          # skips if samples already exist
//   node scripts/seed-sample-meals.mjs --force  # add another batch anyway
//
// Reads NOTION_TOKEN + NOTION_DATA_SOURCE_ID from .env.local.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client } from "@notionhq/client";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env.local");
const MARKER = "· sample";
const DAYS = 7;

const BREAKFAST = [
  { name: "Oatmeal & eggs", calories: 420, protein: 28, carbs: 45, fat: 14 },
  { name: "Greek yogurt & berries", calories: 350, protein: 30, carbs: 40, fat: 8 },
  { name: "Avocado toast & eggs", calories: 480, protein: 22, carbs: 38, fat: 26 },
];
const LUNCH = [
  { name: "Chicken & rice bowl", calories: 620, protein: 52, carbs: 68, fat: 16 },
  { name: "Turkey sandwich", calories: 540, protein: 38, carbs: 55, fat: 18 },
  { name: "Salmon & greens", calories: 560, protein: 42, carbs: 22, fat: 32 },
];
const DINNER = [
  { name: "Steak & potatoes", calories: 720, protein: 55, carbs: 50, fat: 32 },
  { name: "Pasta & meatballs", calories: 780, protein: 42, carbs: 88, fat: 26 },
  { name: "Tofu veggie stir-fry", calories: 610, protein: 34, carbs: 62, fat: 24 },
];
const SNACK = [
  { name: "Protein shake", calories: 180, protein: 30, carbs: 8, fat: 3 },
  { name: "Apple & peanut butter", calories: 260, protein: 8, carbs: 30, fat: 14 },
  { name: "Handful of almonds", calories: 200, protein: 7, carbs: 7, fat: 18 },
];

function readToken() {
  let raw;
  try {
    raw = readFileSync(ENV_PATH, "utf8");
  } catch {
    console.error(`✗ Couldn't read ${ENV_PATH}.`);
    process.exit(1);
  }
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

// Local-timezone calendar date (matches getTodayDate() in lib/notion.ts).
function isoDate(d) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const g = (t) => parts.find((p) => p.type === t).value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}

function mealRow(meal, date, slot) {
  return {
    Meal: { title: [{ text: { content: meal.name } }] },
    Date: { date: { start: date } },
    Calories: { number: meal.calories },
    "Protein (g)": { number: meal.protein },
    "Carbs (g)": { number: meal.carbs },
    "Fat (g)": { number: meal.fat },
    Notes: { rich_text: [{ text: { content: `${slot} ${MARKER}` } }] },
  };
}

function buildRows() {
  const rows = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = isoDate(d);
    rows.push(mealRow(BREAKFAST[i % 3], date, "Breakfast"));
    rows.push(mealRow(LUNCH[(i + 1) % 3], date, "Lunch"));
    rows.push(mealRow(DINNER[(i + 2) % 3], date, "Dinner"));
    if (i % 2 === 0) rows.push(mealRow(SNACK[i % 3], date, "Snack"));
  }
  return rows;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function alreadySeeded(notion, dataSourceId) {
  const res = await notion.dataSources.query({
    data_source_id: dataSourceId,
    page_size: 100,
  });
  return res.results.some((page) => {
    const notes = page.properties?.Notes?.rich_text ?? [];
    return notes.some((t) => (t.plain_text ?? "").includes(MARKER));
  });
}

async function main() {
  const env = readToken();
  if (!env.NOTION_TOKEN || !env.NOTION_DATA_SOURCE_ID) {
    console.error("✗ NOTION_TOKEN and NOTION_DATA_SOURCE_ID must be set in .env.local.");
    process.exit(1);
  }

  const notion = new Client({ auth: env.NOTION_TOKEN });
  const dataSourceId = env.NOTION_DATA_SOURCE_ID;
  const force = process.argv.includes("--force");

  if (!force && (await alreadySeeded(notion, dataSourceId))) {
    console.log(`• Sample rows already present (tagged "${MARKER}"). Use --force to add more.`);
    return;
  }

  const rows = buildRows();
  console.log(`• Inserting ${rows.length} sample meals across ${DAYS} days...`);
  let n = 0;
  for (const properties of rows) {
    await notion.pages.create({
      parent: { type: "data_source_id", data_source_id: dataSourceId },
      properties,
    });
    n++;
    await sleep(280); // stay comfortably under Notion's rate limit
  }
  console.log(`✓ Added ${n} sample meals. Refresh the dashboard to see the charts.`);
  console.log(`  To remove them later, filter the Notes column by "${MARKER}" and delete.`);
}

main().catch((err) => {
  console.error("✗ Seeding failed:", err?.body ?? err?.message ?? err);
  process.exit(1);
});
