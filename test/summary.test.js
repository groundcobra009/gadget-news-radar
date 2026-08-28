// 要約の正規化。LLMが返す型を一切信用しない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSummary } from "../src/summary.js";

test("正しい形はそのまま通る", () => {
  const s = normalizeSummary({
    headline: "Googleの発表が集中した一日",
    lead: "GeminiとNotebookの新機能が同日に公開された。",
    points: ["Gemini 3.5 Transcribeが公開", "Anthropicが規格MHSを発表"],
  });
  assert.equal(s.headline, "Googleの発表が集中した一日");
  assert.equal(s.lead, "GeminiとNotebookの新機能が同日に公開された。");
  assert.deepEqual(s.points, ["Gemini 3.5 Transcribeが公開", "Anthropicが規格MHSを発表"]);
});

test("旧仕様の文字列は lead として受ける（後方互換）", () => {
  const s = normalizeSummary("今日はAIノートPCの発表が中心。");
  assert.equal(s.lead, "今日はAIノートPCの発表が中心。");
  assert.equal(s.headline, null);
  assert.deepEqual(s.points, []);
});

test("何も取れなければ null", () => {
  for (const bad of [null, undefined, 123, [], "", "   ", {}, { headline: 5, points: "配列でない" }]) {
    assert.equal(normalizeSummary(bad), null, `入力: ${JSON.stringify(bad)}`);
  }
});

test("points の文字列以外は落とす", () => {
  const s = normalizeSummary({ lead: "概況", points: ["有効", 42, null, { a: 1 }, "も有効"] });
  assert.deepEqual(s.points, ["有効", "も有効"]);
});

test("points は6件までに切る（メールが長くなりすぎないように）", () => {
  const s = normalizeSummary({ lead: "概況", points: Array.from({ length: 10 }, (_, i) => `点${i}`) });
  assert.equal(s.points.length, 6);
});

test("サニタイズが効く（タグ偽装を持ち込ませない）", () => {
  const s = normalizeSummary({ headline: "<b>見出し</b>", lead: "改行\nを含む", points: ["<i>点</i>"] });
  assert.equal(s.headline, "＜b＞見出し＜/b＞");
  assert.equal(s.lead, "改行 を含む");
  assert.deepEqual(s.points, ["＜i＞点＜/i＞"]);
});

test("headline だけ・points だけでも成立する", () => {
  assert.equal(normalizeSummary({ headline: "見出しのみ" }).headline, "見出しのみ");
  assert.deepEqual(normalizeSummary({ points: ["点のみ"] }).points, ["点のみ"]);
});
