// Dev helper: insert ~two weeks of sample weigh-ins into the Weight Log so the
// weight graph has something to render. Each row is tagged "· sample" in Notes
// so you can spot and bulk-delete them later.
//
//   node scripts/seed-sample-weights.mjs          # skips if samples already exist
//   node scripts/seed-sample-weights.mjs --force  # add another batch anyway
//
// Reads NOTION_TOKEN + NOTION_WEIGHT_DATA_SOURCE_ID from .env.local.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client } from "@notionhq/client";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env.local");
const MARKER = "· sample";

// Oldest → newest: a gentle downward trend with realistic day-to-day noise (lbs).
const WEIGHTS = [
  185.2, 185.0, 184.6, 184.9, 184.3, 184.0, 184.2,
  183.7, 183.5, 183.8, 183.1, 182.9, 183.0, 182.6,
];

function readEnv() {
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function alreadySeeded(notion, dataSourceId) {
  const res = await notion.dataSources.query({ data_source_id: dataSourceId, page_size: 100 });
  return res.results.some((page) => {
    const notes = page.properties?.Notes?.rich_text ?? [];
    return notes.some((t) => (t.plain_text ?? "").includes(MARKER));
  });
}

async function main() {
  const env = readEnv();
  if (!env.NOTION_TOKEN || !env.NOTION_WEIGHT_DATA_SOURCE_ID) {
    console.error("✗ NOTION_TOKEN and NOTION_WEIGHT_DATA_SOURCE_ID must be set in .env.local.");
    console.error("  Run `node scripts/setup-weight-db.mjs` first.");
    process.exit(1);
  }

  const notion = new Client({ auth: env.NOTION_TOKEN });
  const dataSourceId = env.NOTION_WEIGHT_DATA_SOURCE_ID;
  const force = process.argv.includes("--force");

  if (!force && (await alreadySeeded(notion, dataSourceId))) {
    console.log(`• Sample weigh-ins already present (tagged "${MARKER}"). Use --force to add more.`);
    return;
  }

  const n = WEIGHTS.length;
  console.log(`• Inserting ${n} sample weigh-ins...`);
  let added = 0;
  for (let j = 0; j < n; j++) {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - j)); // oldest first, ending today
    await notion.pages.create({
      parent: { type: "data_source_id", data_source_id: dataSourceId },
      properties: {
        Entry: { title: [{ text: { content: "Weigh-in" } }] },
        Date: { date: { start: isoDate(d) } },
        "Weight (lbs)": { number: WEIGHTS[j] },
        Notes: { rich_text: [{ text: { content: MARKER } }] },
      },
    });
    added++;
    await sleep(280); // stay under Notion's rate limit
  }
  console.log(`✓ Added ${added} sample weigh-ins. Refresh the dashboard to see the weight graph.`);
  console.log(`  To remove them later, filter the Notes column by "${MARKER}" and delete.`);
}

main().catch((err) => {
  console.error("✗ Seeding failed:", err?.body ?? err?.message ?? err);
  process.exit(1);
});
