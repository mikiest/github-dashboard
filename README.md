# GitHub PR Dashboard (TypeScript, React + Node)

A sleek dashboard to monitor Pull Requests across your favorite repositories in an organization.

* **Frontend**: React + TypeScript + Vite + Tailwind + React Query + Framer Motion
* **Backend**: Node.js + TypeScript + Express, uses **GitHub CLI** (`gh`) and **GraphQL** via `gh api graphql`
* **No GitHub OAuth needed**: you manually set your GitHub username in the UI
* **Storage**: per-browser via `localStorage` (favorites, settings, pins)

---

## ✨ Features

### PR Dashboard

* **Favorite repos** (per-org) and aggregate their PRs
* **Open / Merged toggle** using a single **GraphQL** request per batch of repos
* **Metadata**: title, author, created/updated time, draft flag, approvals, requested reviewers, base/head branches
* **Diff indicators**: green/red block grid with `+additions / -deletions · changedFiles`
* **Review highlighting**: 👀 badge when the typed username is requested as a reviewer
* **Sorting**: by **last updated** (desc)
* **Search**: client-side, free-text filter by **title**, **author**, or **repo**
* **“Mine” filter**: only PRs authored by your typed username
* **“Stale” filter**: PRs not updated or reviewed in **> 7 days**
* **Merged view**: list **recently merged** PRs, sorted by merged time
* **Polling**: auto-refresh with backoff on rate-limit (429). Manual **Refresh** shows a spinner
* **Animation**: only when a **refetch finds brand-new PRs** (not on first render or pagination)
* **Pin PRs**: manual pin/unpin keeps PRs **at the top** (persisted). Pin button sits **bottom-right**, shows on **hover** (always visible if pinned)
* **Branch display**: mono text at top near repo; **max 200px** with ellipsis and **tooltip** for full branches
* **Timestamps**: “**… ago**” with colors — **red ≤ 4h**, **yellow ≤ 24h**, gray otherwise. Exact time on **hover**
* **Pagination**: numbered pages (20 per page)
* **Layout polish**: right-side stats are **absolute** (top-right) with extra right padding to prevent overflow

### Top Reviewers (new view)

* **Windows**: **24h / 7d / 30d**
* **Repo scope**: automatically uses your **favorite repos** as the dataset (no extra UI needed)
* **Ranking**: totals of **submitted reviews** (not per inline comment). Breakdowns for **Approvals**, **Changes Requested**, **Comments**
* **Usernames**: clickable to GitHub profile, **no underline**; shows **full name** underneath (fetched in the same GraphQL query — no extra round-trips)
* **Medals**: 🥇 🥈 🥉 for the top 3 reviewers
* **Sidebar switch (reviewers tab)**: left sidebar becomes a **Reviewer filter** (search + checkboxes). Selecting users filters the table
* **Timestamp**: **Last review** shows “… ago” with same color scheme, exact time on hover

### Repo Picker

* Org repositories loaded via `gh repo list`
* **Search box** to filter repos
* Toggle **favorite** per repo (persisted)
* PR list is **not cleared** when favorites change; remains stable while refreshing

---

## 🧠 What counts as a “review”?

The reviewers view counts **submitted reviews** (`PullRequestReview`): `APPROVED`, `CHANGES_REQUESTED`, and `COMMENTED/DISMISSED`.
It **does not** count each inline comment as separate points. (We can add a “per-comment” mode if you want.)

---

## 🏗️ Architecture

* **Server**

  * Express + TypeScript + `tsx` runner (ESM)
  * **GraphQL via `gh`**: batches multiple repositories in one query using aliases to fetch PRs with **additions/deletions/changedFiles** and review details in a single round-trip
  * Top Reviewers uses **GraphQL Search** (`search(type: ISSUE, query: … is:pr updated:>=ISO …)`) and aggregates **reviews** within the time window
  * 429 handling: returns **429** on GH rate-limit to let the client back off
* **Client**

  * Vite + React + TypeScript + Tailwind + React Query + Framer Motion
  * Local state persisted in `localStorage`: org, username, favorites, refresh interval, **pins**
  * Smooth UI, subtle animations, dark theme

---

## ⚙️ Configuration

Create `server/.env` (see `.env.example`):

```
ORG_SLUG=your-org        # optional default
PORT=4000                # API port

# Optional tuning
PR_LIMIT=50              # PRs per repo in GraphQL
REPO_BATCH=8             # repos per GraphQL batch
SEARCH_PAGE_LIMIT=5      # pages (100 each) per GraphQL search batch (reviewers view)

# Windows only if gh not in PATH:
# GH_BIN=C:\Program Files\GitHub CLI\gh.exe
```

> **Auth**: ensure `gh` is logged in and has access to your org:

```bash
gh auth status
gh auth login
```

---

## 🚀 Quick Start

```bash
# From project root
npm install
npm run dev
```

* API: `http://localhost:4000`
* App: `http://localhost:5174`

Prefer separate terminals?

```bash
cd server && npm run dev
cd client && npm run dev
```

---

## 🧪 Usage

1. Enter your **org** and **username** (no OAuth used, only for highlighting).
2. In **Repo Picker**, search and ⭐️ **favorite** repos.
3. Open the **PRs** tab:

   * Toggle **Open/Merged**, set filters (Mine/Stale), search, pin key PRs, paginate.
4. Switch to **Reviewers**:

   * Choose **24h/7d/30d** window.
   * Use the sidebar **Reviewer filter** to focus on specific people.
   * Click a reviewer to open their GitHub profile.

---

## 🩹 Troubleshooting

* **Client proxy error `/api/...`** → ensure server prints `API listening on http://localhost:4000`
* **ESM/CJS error** → server uses `tsx`; run from `server/` with `npm run dev`
* **`gh` not found** → install GitHub CLI and/or set `GH_BIN` in `.env`
* **403/429 rate limit** → client backs off; increase refresh interval or narrow favorites
* **Windows PATH** → open a new terminal after installing `gh`

---

## 🗺️ Roadmap (ideas)

* SSE or WebSocket live updates
* “Per-comment” scoring mode in Reviewers
* CSV export for Reviewers + PRs
* Saved filter presets and shareable links
* Compact row mode & keyboard shortcuts (f = focus filter, r = refresh)

---

## 📝 License

MIT
