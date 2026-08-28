// LLMに渡す入力を絞る層。余計なキーが漏れないことを固定する。
import { test } from "node:test";
import assert from "node:assert/strict";
import { toJudgeInput, ALLOWED_KEYS } from "../src/judge-input.js";

test("判定に必要な5項目だけを渡す", () => {
  const [slim] = toJudgeInput([
    {
      id: "abc",
      title: "記事",
      source: "PC Watch",
      publishedAt: "2026-08-28T03:00:00.000Z",
      summary: "概要",
      url: "https://example.com/a",
      score: 9,
      matchedKeywords: ["AI"],
      sourceId: "pc-watch",
      dateUnknown: false,
    },
  ]);
  assert.deepEqual(Object.keys(slim).sort(), [...ALLOWED_KEYS].sort());
  assert.equal(slim.id, "abc");
  assert.equal(slim.title, "記事");
});

test("スコアや内部情報は渡さない（判定を歪めないため）", () => {
  const [slim] = toJudgeInput([{ id: "a", title: "t", score: 99, matchedGroups: ["AI"] }]);
  assert.equal(slim.score, undefined);
  assert.equal(slim.matchedGroups, undefined);
});

test("欠けている項目は null で埋める（キーの形を固定する）", () => {
  const [slim] = toJudgeInput([{ id: "a" }]);
  assert.equal(slim.publishedAt, null);
  assert.equal(slim.summary, null);
});

test("空配列でも落ちない", () => {
  assert.deepEqual(toJudgeInput([]), []);
  assert.deepEqual(toJudgeInput(null), []);
});
