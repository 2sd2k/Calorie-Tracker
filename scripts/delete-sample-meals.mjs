// Remove the seeded sample meals. Only rows whose Notes contain the "· sample"
// marker are trashed, so any meals you logged yourself are left alone. Notion
// keeps trashed pages recoverable for ~30 days, and you can always re-seed.
//
//   node scripts/delete-sample-meals.mjs
//
// Reads NOTION_TOKEN + NOTION_DATA_SOURCE_ID from .env.local.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client } from "@notionhq/client";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env.local");
const MARKER = "· sample";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function main() {
  const env = readEnv();
  if (!env.NOTION_TOKEN || !env.NOTION_DATA_SOURCE_ID) {
    console.error("✗ NOTION_TOKEN and NOTION_DATA_SOURCE_ID must be set in .env.local.");
    process.exit(1);
  }

  const notion = new Client({ auth: env.NOTION_TOKEN });
  const dataSourceId = env.NOTION_DATA_SOURCE_ID;

  // Collect every sample-tagged page (following pagination).
  const ids = [];
  let cursor;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of res.results) {
      const notes = page.properties?.Notes?.rich_text ?? [];
      if (notes.some((t) => (t.plain_text ?? "").includes(MARKER))) ids.push(page.id);
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  if (ids.length === 0) {
    console.log(`• No sample rows found (nothing tagged "${MARKER}").`);
    return;
  }

  console.log(`• Trashing ${ids.length} sample meals...`);
  let n = 0;
  for (const page_id of ids) {
    await notion.pages.update({ page_id, in_trash: true });
    n++;
    await sleep(280); // stay under Notion's rate limit
  }
  console.log(`✓ Removed ${n} sample meals. Refresh the dashboard — it'll show "No data yet" until you log a real meal.`);
}

main().catch((err) => {
  console.error("✗ Delete failed:", err?.body ?? err?.message ?? err);
  process.exit(1);
});
