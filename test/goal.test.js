// ゴールコマンドのHTML検証ロジック。
// 「メールとして壊れているHTMLを合格にしない」ことをここで担保する。
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDigestHtml } from "../src/goal.js";
import { renderEmailHtml } from "../src/render.js";
import { jstWindow } from "../src/window.js";

const WIN = jstWindow(new Date("2026-08-28T20:40:00Z"));
const GOOD = renderEmailHtml({
  window: WIN,
  generatedAt: "2026-08-29T05:02:00+09:00",
  summary: { headline: "見出し", lead: "要約", points: ["論点1"] },
  items: [
    {
      id: "a",
      title: "記事",
      url: "https://example.com/a",
      source: "ITmedia NEWS",
      publishedAt: "2026-08-28T01:00:00.000Z",
      score: 5,
      stars: 3,
      reason: "理由",
    },
  ],
  sourceStatuses: [{ sourceId: "x", name: "X", ok: true, error: null }],
  unjudgedCount: 0,
  stats: { fetchedCount: 10, inWindowCount: 5, dedupedCount: 0, truncated: 0 },
});

test("実際に生成したHTMLは検証を通る", () => {
  const { ok, reasons } = validateDigestHtml(GOOD, 1);
  assert.equal(ok, true, reasons.join(" / "));
});

test("候補0件は不合格（収集が壊れているのに成功扱いにしない）", () => {
  const { ok, reasons } = validateDigestHtml(GOOD, 0);
  assert.equal(ok, false);
  assert.ok(reasons.some((r) => r.includes("候補が1件もありません")));
});

test("見出しが欠けていたら不合格", () => {
  const broken = GOOD.replace("ソースの取得状況", "その他");
  assert.equal(validateDigestHtml(broken, 1).ok, false);
});

test("外部リソースが混ざったら不合格", () => {
  for (const injected of [
    '<script src="https://x/a.js"></script>',
    '<link rel="stylesheet" href="https://x/a.css">',
    "<style>p{color:red}</style>",
    '<img src="https://x/a.png">',
    '<div style="background:url(https://x/a.png)"></div>',
  ]) {
    const { ok } = validateDigestHtml(GOOD + injected, 1);
    assert.equal(ok, false, `検出できていない: ${injected}`);
  }
});
