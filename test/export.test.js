// 他リポジトリ向けの書き出し。読む側との契約なので、鍵の形を固定する。
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExport, ITEM_KEYS } from "../src/export.js";
import { jstWindow } from "../src/window.js";

const WIN = jstWindow(new Date("2026-08-28T20:40:00Z"));

const ITEMS = [
  {
    id: "a",
    title: "AIチップ発表",
    url: "https://example.com/a",
    source: "PC Watch",
    sourceRegion: "国内",
    sourceId: "pc-watch",
    publishedAt: "2026-08-28T03:00:00.000Z",
    score: 8,
    stars: 2,
    reason: "推論性能2倍",
    matchedGroups: ["AI・生成AI", "新製品・発表"],
    matchedKeywords: ["AI", "発表"],
    summary: "本文の抜粋",
    dateUnknown: false,
  },
  {
    id: "b",
    title: "折りたたみの噂",
    url: "https://example.com/b",
    source: "すまほん!!",
    sourceRegion: "国内",
    publishedAt: null,
    score: 2,
    stars: 3,
    reason: null,
    matchedGroups: [],
  },
  { id: "c", title: "未判定の記事", url: "https://example.com/c", source: "X", score: 5, stars: null },
];

test("読む側が使う項目だけを出す（内部情報は漏らさない）", () => {
  const out = buildExport({ window: WIN, generatedAt: "2026-08-29T05:02:00+09:00", items: ITEMS, summary: null });
  assert.deepEqual(Object.keys(out.items[0]).sort(), [...ITEM_KEYS].sort());
  assert.equal(out.items[0].summary, undefined, "記事本文の抜粋は渡さない");
  assert.equal(out.items[0].sourceId, undefined);
  assert.equal(out.items[0].matchedKeywords, undefined);
});

test("推奨度の高い順、同点はスコア順に並ぶ", () => {
  const out = buildExport({ window: WIN, generatedAt: "x", items: ITEMS, summary: null });
  assert.deepEqual(out.items.map((i) => i.id), ["b", "a", "c"]);
});

test("keywords.yaml のグループを渡す（読む側がAI系だけ抜けるように）", () => {
  const out = buildExport({ window: WIN, generatedAt: "x", items: ITEMS, summary: null });
  const a = out.items.find((i) => i.id === "a");
  assert.deepEqual(a.groups, ["AI・生成AI", "新製品・発表"]);
  assert.deepEqual(out.items.find((i) => i.id === "c").groups, [], "無い場合は空配列で形を固定する");
});

test("件数の内訳を添える", () => {
  const out = buildExport({ window: WIN, generatedAt: "x", items: ITEMS, summary: null });
  assert.deepEqual(out.counts, { total: 3, stars3: 1, stars2: 1, stars1: 0, unjudged: 1 });
});

test("窓とスキーマ版を含む（読む側が鮮度と互換を判断できるように）", () => {
  const out = buildExport({ window: WIN, generatedAt: "2026-08-29T05:02:00+09:00", items: ITEMS, summary: null });
  assert.equal(out.producer, "gadget-news-radar");
  assert.equal(out.schemaVersion, 1);
  assert.equal(out.window.startIso, WIN.startIso);
  assert.equal(out.window.dateLabel, "2026-08-29");
  assert.equal(out.generatedAt, "2026-08-29T05:02:00+09:00");
});

test("要約はそのまま渡す（読む側がその日の傾向を掴めるように）", () => {
  const summary = { headline: "見出し", lead: "概況", points: ["論点"] };
  assert.deepEqual(buildExport({ window: WIN, generatedAt: "x", items: [], summary }).summary, summary);
});

test("記事0件でも壊れない", () => {
  const out = buildExport({ window: WIN, generatedAt: "x", items: [], summary: null });
  assert.deepEqual(out.items, []);
  assert.equal(out.counts.total, 0);
});
