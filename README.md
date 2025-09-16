# GitHub PR Dashboard (TypeScript, React + Node)

A sleek dashboard to monitor Pull Requests across your favorite repositories in an organization.
- **Frontend**: React + TypeScript + Vite + Tailwind + React Query + Framer Motion
- **Backend**: Node.js + TypeScript + Express, shells out to **GitHub CLI** (`gh`) for data
- **No GitHub OAuth needed**: you manually set your GitHub username in the UI; favorites are stored locally

## Features
- Pick an **org**, browse its repos, **favorite** the ones you care about
- Aggregate **open PRs** from favorites with: title, author, created/updated time, draft flag, approvals, and +/- **diff indicators**
- **Highlight** PRs that explicitly **request your review**
- Auto-refresh with subtle **animations** when **new or updated** PRs arrive
- Quick filtering, sorting, and search

## Prerequisites
- Node 18+
- GitHub CLI: https://cli.github.com/
- Authenticated `gh` session with appropriate scopes (usually `repo` is enough)
  ```bash
  gh auth login
  ```

## Quick Start
```bash
# From the project root
npm install
# Start both server and client
npm run dev
```

- Server runs on **http://localhost:4000**
- Client runs on **http://localhost:5173** (Vite)
- By default CORS is open to localhost during development

## Configure
The app is mostly configured from the UI. You can set a default org via env:

- Copy `server/.env.example` to `server/.env` and set:
```
ORG_SLUG=your-org
PORT=4000
```

> The client stores your **favorites** and **username** in `localStorage`.

## Production
```bash
npm run build
# Then start just the API (you can host the client statics elsewhere)
npm run start
```

## Notes on `gh` usage
The server calls `gh` for repo and PR data. It first lists PRs and then enriches each PR with diff stats via `gh pr view`.
If you see errors, ensure:
- `gh` is installed and on PATH for the Node process
- You ran `gh auth login`
- The token has access to your org's repos

## License
MIT
