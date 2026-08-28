// 契約テスト（最重要）。
// エージェントが judgments.json を書かなくても、壊して書いても、レンダーは落ちず
// 「未判定」として必ずメールに出す。無言の失敗を原理的に起こさないための層。
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyJudgments } from "../src/judgments.js";

const CANDIDATES = [
  { id: "a", title: "記事A", score: 5 },
  { id: "b", title: "記事B", score: 3 },
];

test("judgments が無い（null）→ 全件未判定で続行する", () => {
  const r = applyJudgments(CANDIDATES, null);
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.items.map((i) => i.stars), [null, null]);
  assert.equal(r.unjudgedCount, 2);
  assert.equal(r.summary, null);
});

test("judgments が配列でも文字列でも壊れていても落ちない", () => {
  for (const broken of [[], "壊れています", 42, {}, { items: "配列ではない" }]) {
    const r = applyJudgments(CANDIDATES, broken);
    assert.equal(r.items.length, 2, `入力: ${JSON.stringify(broken)}`);
  }
});

test("正常な判定はマージされる", () => {
  const r = applyJudgments(CANDIDATES, {
    summary: { headline: "今日は3本", lead: "内訳はAIが2本、周辺機器が1本。", points: ["MCP更新"] },
    items: [
      { id: "a", stars: 3, reason: "一次情報の正式発表" },
      { id: "b", stars: 1, reason: "噂のみ" },
    ],
  });
  assert.equal(r.summary.headline, "今日は3本");
  assert.equal(r.summary.lead, "内訳はAIが2本、周辺機器が1本。");
  assert.deepEqual(r.summary.points, ["MCP更新"]);
  assert.equal(r.items[0].stars, 3);
  assert.equal(r.items[0].reason, "一次情報の正式発表");
  assert.equal(r.items[1].stars, 1);
  assert.equal(r.unjudgedCount, 0);
});

test("stars が 1/2/3 以外（範囲外・文字列）は未判定にする", () => {
  const r = applyJudgments(CANDIDATES, {
    items: [
      { id: "a", stars: 4, reason: "範囲外" },
      { id: "b", stars: "3", reason: "文字列" },
    ],
  });
  assert.deepEqual(r.items.map((i) => i.stars), [null, null]);
  assert.equal(r.unjudgedCount, 2);
});

test("candidates に無い未知IDは無視する（幻の記事を混入させない）", () => {
  const r = applyJudgments(CANDIDATES, {
    items: [
      { id: "a", stars: 3, reason: "ok" },
      { id: "存在しないID", stars: 3, reason: "幻" },
    ],
  });
  assert.equal(r.items.length, 2);
  assert.ok(!r.items.some((i) => i.id === "存在しないID"));
});

test("judgments に載っていない候補は未判定としてレポートに残る（判定漏れを隠さない）", () => {
  const r = applyJudgments(CANDIDATES, { items: [{ id: "a", stars: 3, reason: "ok" }] });
  assert.equal(r.items.length, 2);
  assert.equal(r.items[1].stars, null);
  assert.equal(r.unjudgedCount, 1);
});

test("reason は文字列以外なら null にし、サニタイズして取り込む", () => {
  const r = applyJudgments(CANDIDATES, {
    items: [
      { id: "a", stars: 3, reason: { not: "string" } },
      { id: "b", stars: 2, reason: "<b>強調</b>" },
    ],
  });
  assert.equal(r.items[0].reason, null);
  assert.equal(r.items[1].reason, "＜b＞強調＜/b＞");
});

test("summary も文字列以外は null（型を信用しない）", () => {
  assert.equal(applyJudgments(CANDIDATES, { summary: 123, items: [] }).summary, null);
});
