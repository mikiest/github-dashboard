import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import { ghRepos, ghPRsAcross, ghTopReviewers, ghOrgTeams } from "./gh.js";


dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
}));

const PORT = Number(process.env.PORT || 5174);

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.get("/api/orgs/:org/repos", async (req, res) => {
  try {
    const org = req.params.org;
    const data = await ghRepos(org);
    res.json({ repos: data });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

const PRsBody = z.object({
  org: z.string().min(1),
  repos: z.array(z.string().min(1)).min(1),
  states: z.array(z.enum(['open','merged'])).default(['open']).optional(),
  window: z.enum(['24h','7d','30d'])
});

app.post("/api/prs", async (req, res) => {
  try {
    const body = PRsBody.parse(req.body);
    const states = body.states ?? ['open'];
    const data = await ghPRsAcross(body.org, body.repos, true, states as any, body.window);
    res.json({ prs: data });
  } catch (e) {
    console.error("prs error:", e);
    res.status(400).json({ error: (e as Error).message });
  }
});

const TopReviewersBody = z.object({
  org: z.string().min(1),
  window: z.enum(['24h','7d','30d']),
  users: z.array(z.string().min(1)).optional(),
});


app.post("/api/reviewers/top", async (req, res) => {
  try {
    const body = TopReviewersBody.parse(req.body);
    const data = await ghTopReviewers(body.org, body.window, body.users);
    res.json(data);
  } catch (e:any) {
    const msg = `${e?.stderr ?? ''} ${e?.message ?? ''}`;
    if (/rate limit|abuse/i.test(msg) || e?.exitCode === 403) {
      return res.status(429).json({ error: "GitHub rate limit", retryAfterMs: 60000 });
    }
    res.status(400).json({ error: (e as Error).message });
  }
});


app.get("/api/orgs/:org/teams", async (req, res) => {
  try {
    const org = z.string().min(1).parse(req.params.org);
    const teams = await ghOrgTeams(org);
    res.json({ teams });
  } catch (e:any) {
    const msg = `${e?.stderr ?? ''} ${e?.message ?? ''}`;
    if (/rate limit|abuse/i.test(msg) || e?.exitCode === 403) {
      return res.status(429).json({ error: "GitHub rate limit", retryAfterMs: 60000 });
    }
    res.status(400).json({ error: (e as Error).message });
  }
});


app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
