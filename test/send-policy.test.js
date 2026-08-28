// 「送信済みとして記録してよいか」の判断。
// 判定が全滅した回の記事まで既出扱いにすると、その日のニュースが二度と
// 推奨度つきで届かなくなる（1回の失敗でその日の分を焼いてしまう）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldRecordAsSent } from "../src/send-policy.js";

test("通常どおり判定できた回は記録する", () => {
  assert.equal(shouldRecordAsSent({ itemCount: 250, unjudgedCount: 0 }).record, true);
});

test("一部が未判定でも記録する（大半は届いているため）", () => {
  assert.equal(shouldRecordAsSent({ itemCount: 250, unjudgedCount: 12 }).record, true);
});

test("全件が未判定の回は記録しない（翌日にもう一度チャンスを残す）", () => {
  const r = shouldRecordAsSent({ itemCount: 250, unjudgedCount: 250 });
  assert.equal(r.record, false);
  assert.match(r.reason, /全件が未判定/);
});

test("記事が0件の回は記録するものが無い", () => {
  assert.equal(shouldRecordAsSent({ itemCount: 0, unjudgedCount: 0 }).record, false);
});

test("値が欠けていても落ちない（安全側＝記録しないに倒す）", () => {
  assert.equal(shouldRecordAsSent({}).record, false);
  assert.equal(shouldRecordAsSent(null).record, false);
});
