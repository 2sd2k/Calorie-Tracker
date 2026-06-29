# 🍽️ Calorie Tracker

A personal macro/calorie dashboard. You log each meal as a row in a **Notion** database;
this Next.js app reads it via the Notion API, rolls meals up into daily totals, and graphs
your calories and macros over time.

## How it works

```
Notion "Meals Log" DB  ──Notion API──►  Next.js app  ──►  daily totals + charts
   (one row per meal)                    (aggregates by day)
```

- **Log:** add a row per meal in Notion (Meal, Date, Calories, Protein, Carbs, Fat, Notes).
- **View:** the dashboard sums each day's meals and renders calorie + macro progression graphs.

## Setup

1. **Notion integration** — create an internal integration at
   [notion.so/my-integrations](https://www.notion.so/my-integrations) and copy its token.
2. **Share the database** — open the *Meals Log* database in Notion → `•••` → **Connections**
   → add your integration.
3. **Environment** — copy `.env.example` to `.env.local` and set:
   - `NOTION_TOKEN` — the integration token
   - `NOTION_DATA_SOURCE_ID` — already filled in (`a3afae23-…`)
4. **Run:**
   ```bash
   npm install
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Deploy (Vercel)

Push to GitHub, import the repo at [vercel.com/new](https://vercel.com/new), and add the same
two environment variables in the project settings. Every push redeploys.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Recharts · `@notionhq/client` v5
