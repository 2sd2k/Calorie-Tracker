// One-time setup: create the "Meals Log" database in Notion with the exact
// schema the dashboard reads, then write its data source ID into .env.local.
//
// Prereq: create ONE page in Notion and share it with your integration
// (page → ••• → Connections → add the integration). This script finds that
// page, creates the database under it, and is safe to re-run (it reuses an
// existing "Meals Log" instead of making duplicates).
//
//   node scripts/setup-notion-db.mjs
//
// Node's built-in .env loading isn't assumed, so we parse .env.local ourselves.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client, isFullDatabase } from "@notionhq/client";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env.local");
const DB_TITLE = "Meals Log";

// The schema the app expects. Keep in sync with REQUIRED_PROPS in lib/notion.ts.
const PROPERTIES = {
  Meal: { title: {} },
  Date: { date: {} },
  Calories: { number: {} },
  "Protein (g)": { number: {} },
  "Carbs (g)": { number: {} },
  "Fat (g)": { number: {} },
  Notes: { rich_text: {} },
};

function readEnv() {
  let raw;
  try {
    raw = readFileSync(ENV_PATH, "utf8");
  } catch {
    console.error(`✗ Couldn't read ${ENV_PATH}. Copy .env.example to .env.local first.`);
    process.exit(1);
  }
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return { raw, env };
}

function writeDataSourceId(raw, id) {
  const line = `NOTION_DATA_SOURCE_ID=${id}`;
  const next = /^NOTION_DATA_SOURCE_ID=.*$/m.test(raw)
    ? raw.replace(/^NOTION_DATA_SOURCE_ID=.*$/m, line)
    : raw.replace(/\n*$/, `\n${line}\n`);
  writeFileSync(ENV_PATH, next);
}

function titleOf(obj) {
  const props = obj.properties ?? {};
  for (const value of Object.values(props)) {
    if (value?.type === "title") {
      return value.title.map((t) => t.plain_text).join("") || "(untitled)";
    }
  }
  // Databases carry their title at the top level, not in properties.
  if (Array.isArray(obj.title)) return obj.title.map((t) => t.plain_text).join("");
  return "(untitled)";
}

async function main() {
  const { raw, env } = readEnv();
  if (!env.NOTION_TOKEN) {
    console.error("✗ NOTION_TOKEN is not set in .env.local.");
    process.exit(1);
  }

  const notion = new Client({ auth: env.NOTION_TOKEN });

  // Everything the integration can currently see.
  const pages = [];
  const databases = [];
  let cursor;
  do {
    const res = await notion.search({ start_cursor: cursor, page_size: 100 });
    for (const r of res.results) {
      if (r.object === "page") pages.push(r);
      else if (r.object === "database") databases.push(r);
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  // Idempotency: reuse an existing "Meals Log" database if one is shared.
  const existing = databases.find(
    (d) => isFullDatabase(d) && titleOf(d).trim() === DB_TITLE,
  );
  if (existing) {
    const dsId = existing.data_sources?.[0]?.id;
    if (!dsId) {
      console.error(`✗ Found "${DB_TITLE}" but it has no data source. Delete it and re-run.`);
      process.exit(1);
    }
    writeDataSourceId(raw, dsId);
    console.log(`✓ Reused existing "${DB_TITLE}".`);
    console.log(`  data source id: ${dsId}`);
    console.log(`  → wrote NOTION_DATA_SOURCE_ID to .env.local`);
    return;
  }

  if (pages.length === 0) {
    console.error(
      [
        "✗ Your integration can't see any pages yet.",
        "",
        "  In Notion:",
        "  1. Create a new page (e.g. \"Calorie Tracker\").",
        "  2. Open it → ••• (top-right) → Connections → add your integration.",
        "  3. Re-run this script.",
      ].join("\n"),
    );
    process.exit(2);
  }

  // Prefer a page that looks like it's meant for this; else use the first.
  const parent =
    pages.find((p) => /calorie|tracker|meal|macro/i.test(titleOf(p))) ?? pages[0];

  console.log(`• Creating "${DB_TITLE}" inside page: ${titleOf(parent)}`);
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parent.id },
    title: [{ type: "text", text: { content: DB_TITLE } }],
    initial_data_source: { properties: PROPERTIES },
  });

  const dsId = isFullDatabase(db) ? db.data_sources?.[0]?.id : undefined;
  if (!dsId) {
    console.error("✗ Database created but no data source id came back:", JSON.stringify(db, null, 2));
    process.exit(1);
  }

  writeDataSourceId(raw, dsId);
  console.log(`✓ Created "${DB_TITLE}".`);
  if (isFullDatabase(db)) console.log(`  url: ${db.url}`);
  console.log(`  data source id: ${dsId}`);
  console.log(`  → wrote NOTION_DATA_SOURCE_ID to .env.local`);
}

main().catch((err) => {
  console.error("✗ Setup failed:", err?.body ?? err?.message ?? err);
  process.exit(1);
});
