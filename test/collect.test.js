// 収集パイプライン全体。1フィードが落ちても他は続行し、落ちた事実は必ず残す。
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectAll } from "../src/collect.js";
import { jstWindow } from "../src/window.js";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const raw = (name) => fs.readFileSync(path.join(FIX, name));

const NOW = new Date("2026-08-28T20:40:00Z"); // 2026-08-29 05:40 JST
const WIN = jstWindow(NOW);

const SOURCES = [
  { id: "ok1", name: "正常A", url: "https://a.example.com/feed", priority: "A", region: "国内", enabled: true },
  { id: "ng", name: "落ちてる", url: "https://ng.example.com/feed", priority: "B", region: "海外", enabled: true },
  { id: "ok2", name: "正常B", url: "https://b.example.com/feed", priority: "A", region: "国内", enabled: true },
  { id: "off", name: "無効", url: "https://off.example.com/feed", priority: "A", region: "国内", enabled: false },
];

const GROUPS = [{ name: "AI", weight: 3, keywords: ["AI", "GPU"] }];

function fetcherByHost(map) {
  return async (url) => {
    const host = new URL(url).host;
    const entry = map[host];
    if (!entry) throw new Error(`未定義のホスト: ${host}`);
    if (entry.throws) throw new Error(entry.throws);
    return { ok: true, status: 200, body: raw(entry.fixture), contentType: "application/xml" };
  };
}

const FETCHER = fetcherByHost({
  "a.example.com": { fixture: "rss2.xml" },
  "ng.example.com": { throws: "ECONNREFUSED" },
  "b.example.com": { fixture: "rdf.xml" },
});

test("1フィードの失敗で全体が止まらず、他のソースは収集される", async () => {
  const r = await collectAll({ sources: SOURCES, keywordGroups: GROUPS, now: NOW, fetcher: FETCHER });
  assert.ok(r.candidates.length > 0);
  const ng = r.sourceStatuses.find((s) => s.sourceId === "ng");
  assert.equal(ng.ok, false);
  assert.ok(ng.error.includes("ECONNREFUSED"));
  assert.equal(r.sourceStatuses.filter((s) => s.ok).length, 2);
});

test("enabled:false のソースは巡回もステータス記録もしない", async () => {
  const r = await collectAll({ sources: SOURCES, keywordGroups: GROUPS, now: NOW, fetcher: FETCHER });
  assert.ok(!r.sourceStatuses.some((s) => s.sourceId === "off"));
});

test("24時間窓の外の記事は落とし、件数として残す", async () => {
  const oldWin = jstWindow(new Date("2026-09-10T20:40:00Z")); // ずっと後の窓
  const r = await collectAll({
    sources: [SOURCES[0]],
    keywordGroups: GROUPS,
    now: new Date("2026-09-10T20:40:00Z"),
    fetcher: FETCHER,
  });
  assert.equal(r.candidates.filter((c) => !c.dateUnknown).length, 0);
  assert.ok(r.sourceStatuses[0].outOfWindowCount > 0);
  assert.equal(oldWin.endMs - oldWin.startMs, 86400000);
});

test("日付不明の記事は窓の外でも候補に残す（dateUnknownで印を付ける）", async () => {
  const r = await collectAll({ sources: [SOURCES[0]], keywordGroups: GROUPS, now: NOW, fetcher: FETCHER });
  const unknown = r.candidates.find((c) => c.dateUnknown);
  assert.ok(unknown, "日付不明の記事が候補に残っていない");
  assert.equal(unknown.title, "日付のない記事");
});

test("送信済みの記事は除外される", async () => {
  const processed = { items: [{ url: "https://example.com/news/1" }] };
  const r = await collectAll({
    sources: [SOURCES[0]],
    keywordGroups: GROUPS,
    now: NOW,
    fetcher: FETCHER,
    processed,
  });
  assert.ok(!r.candidates.some((c) => c.title.includes("新型AIノートPC")));
  assert.ok(r.stats.dedupedCount >= 1);
});

test("候補はスコア降順で並び、上限件数で切られる（切った件数は残す）", async () => {
  const r = await collectAll({
    sources: SOURCES,
    keywordGroups: GROUPS,
    now: NOW,
    fetcher: FETCHER,
    maxCandidates: 1,
  });
  assert.equal(r.candidates.length, 1);
  assert.ok(r.stats.truncated >= 1);
});

test("候補はサニタイズ済みで返る（LLMに渡す前提）", async () => {
  const r = await collectAll({ sources: SOURCES, keywordGroups: GROUPS, now: NOW, fetcher: FETCHER });
  for (const c of r.candidates) {
    assert.ok(!c.title.includes("<"), `タイトルに生の山括弧が残っている: ${c.title}`);
  }
});

test("stats に各段の件数が残る（どこで減ったか追えるように）", async () => {
  const r = await collectAll({ sources: SOURCES, keywordGroups: GROUPS, now: NOW, fetcher: FETCHER });
  for (const key of ["fetchedCount", "inWindowCount", "dedupedCount", "truncated"]) {
    assert.equal(typeof r.stats[key], "number", `stats.${key} が無い`);
  }
  assert.equal(r.window.startIso, WIN.startIso);
});
