// キーワードスコアリング。ここは「捨てる」ためではなく「並べる」ためのもの。
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchKeywords, scoreItem } from "../src/filter.js";

const GROUPS = [
  { name: "AI", weight: 3, keywords: ["AI", "生成AI"] },
  { name: "新製品", weight: 2, keywords: ["発表", "launch"] },
  { name: "減点", weight: -3, keywords: ["セール", "deal"] },
];

test("英数字キーワードは単語境界でマッチする（SAIL に AI が当たらない）", () => {
  assert.equal(matchKeywords({ title: "SAILing away" }, GROUPS).score, 0);
  assert.equal(matchKeywords({ title: "AI chip" }, GROUPS).score, 3);
  assert.equal(matchKeywords({ title: "新しいAIの話" }, GROUPS).score, 3);
});

test("日本語キーワードは部分一致する", () => {
  const r = matchKeywords({ title: "新製品を発表しました" }, GROUPS);
  assert.equal(r.score, 2);
  assert.deepEqual(r.matchedGroups, ["新製品"]);
});

test("複数グループのweightは加算され、減点グループは引かれる", () => {
  const r = matchKeywords({ title: "AIノートPCを発表", description: "タイムセールも実施" }, GROUPS);
  assert.equal(r.score, 3 + 2 - 3);
});

test("大文字小文字は無視する", () => {
  assert.equal(matchKeywords({ title: "Big Launch today" }, GROUPS).score, 2);
});

test("scoreItem はソース優先度(A=2/B=1)をキーワードスコアに足す", () => {
  const item = { title: "AIチップを発表", description: "", sourcePriority: "A" };
  assert.equal(scoreItem(item, GROUPS).score, 2 + 3 + 2);
  assert.equal(scoreItem({ ...item, sourcePriority: "B" }, GROUPS).score, 1 + 3 + 2);
});

test("キーワードが1つも当たらなくても候補から消えない（スコアだけ低くなる）", () => {
  const r = scoreItem({ title: "全く関係のない話", sourcePriority: "B" }, GROUPS);
  assert.equal(r.score, 1);
  assert.deepEqual(r.matchedKeywords, []);
});
