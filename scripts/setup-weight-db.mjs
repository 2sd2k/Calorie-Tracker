// One-time setup: create the "Weight Log" database in Notion (columns Date +
// "Weight (lbs)") and write its data source ID into .env.local. It's created
// under the same page as the Meals Log, so no extra sharing step is needed.
//
//   node scripts/setup-weight-db.mjs
//
// Safe to re-run (reuses an existing "Weight Log" instead of duplicating).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client, isFullDatabase } from "@notionhq/client";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env.local");
const DB_TITLE = "Weight Log";
const ENV_KEY = "NOTION_WEIGHT_DATA_SOURCE_ID";

// Keep in sync with REQUIRED_WEIGHT_PROPS in lib/notion.ts.
const PROPERTIES = {
  Entry: { title: {} }, // Notion requires a title column; the app ignores it.
  Date: { date: {} },
  "Weight (lbs)": { number: {} },
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

function writeEnvId(raw, id) {
  const line = `${ENV_KEY}=${id}`;
  const re = new RegExp(`^${ENV_KEY}=.*$`, "m");
  const next = re.test(raw) ? raw.replace(re, line) : raw.replace(/\n*$/, `\n${line}\n`);
  writeFileSync(ENV_PATH, next);
}

function titleOf(obj) {
  const props = obj.properties ?? {};
  for (const value of Object.values(props)) {
    if (value?.type === "title") {
      return value.title.map((t) => t.plain_text).join("") || "(untitled)";
    }
  }
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

  const existing = databases.find(
    (d) => isFullDatabase(d) && titleOf(d).trim() === DB_TITLE,
  );
  if (existing) {
    const dsId = existing.data_sources?.[0]?.id;
    if (!dsId) {
      console.error(`✗ Found "${DB_TITLE}" but it has no data source. Delete it and re-run.`);
      process.exit(1);
    }
    writeEnvId(raw, dsId);
    console.log(`✓ Reused existing "${DB_TITLE}".`);
    console.log(`  data source id: ${dsId}`);
    console.log(`  → wrote ${ENV_KEY} to .env.local`);
    return;
  }

  if (pages.length === 0) {
    console.error(
      [
        "✗ Your integration can't see any pages yet.",
        "  Create a page in Notion, share it with your integration, and re-run.",
      ].join("\n"),
    );
    process.exit(2);
  }

  const parent =
    pages.find((p) => /calorie|tracker|meal|macro|weight/i.test(titleOf(p))) ?? pages[0];

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

  writeEnvId(raw, dsId);
  console.log(`✓ Created "${DB_TITLE}".`);
  if (isFullDatabase(db)) console.log(`  url: ${db.url}`);
  console.log(`  data source id: ${dsId}`);
  console.log(`  → wrote ${ENV_KEY} to .env.local`);
}

main().catch((err) => {
  console.error("✗ Setup failed:", err?.body ?? err?.message ?? err);
  process.exit(1);
});
