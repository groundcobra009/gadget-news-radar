// 24時間窓（JST 05:00 固定境界）の契約テスト。
// GitHub の cron は数分〜数十分遅れるため、窓は実行時刻ではなく固定境界で切る。
import { test } from "node:test";
import assert from "node:assert/strict";
import { jstWindow, classifyDate } from "../src/window.js";

test("05:40 JST に実行しても窓は [前日05:00, 当日05:00) に固定される", () => {
  const now = new Date("2026-08-28T20:40:00Z"); // = 2026-08-29 05:40 JST
  const win = jstWindow(now);
  assert.equal(win.startIso, "2026-08-27T20:00:00.000Z"); // 08-28 05:00 JST
  assert.equal(win.endIso, "2026-08-28T20:00:00.000Z"); // 08-29 05:00 JST
});

test("実行が30分遅れても窓は動かない（穴も重複も出ない）", () => {
  const onTime = jstWindow(new Date("2026-08-28T20:00:05Z"));
  const late = jstWindow(new Date("2026-08-28T20:38:00Z"));
  assert.equal(onTime.startIso, late.startIso);
  assert.equal(onTime.endIso, late.endIso);
});

test("05:00 より前に手動実行すると1つ前の窓になる", () => {
  const now = new Date("2026-08-28T19:30:00Z"); // = 2026-08-29 04:30 JST
  const win = jstWindow(now);
  assert.equal(win.startIso, "2026-08-26T20:00:00.000Z"); // 08-27 05:00 JST
  assert.equal(win.endIso, "2026-08-27T20:00:00.000Z"); // 08-28 05:00 JST
});

test("窓はちょうど24時間", () => {
  const win = jstWindow(new Date("2026-08-28T20:40:00Z"));
  assert.equal(win.endMs - win.startMs, 24 * 60 * 60 * 1000);
});

test("境界: 05:00:00 ちょうどは翌窓、04:59:59 は当窓", () => {
  const win = jstWindow(new Date("2026-08-28T20:40:00Z"));
  assert.equal(classifyDate("2026-08-29T05:00:00+09:00", win), "out");
  assert.equal(classifyDate("2026-08-29T04:59:59+09:00", win), "in");
  assert.equal(classifyDate("2026-08-28T05:00:00+09:00", win), "in"); // 開始は含む
  assert.equal(classifyDate("2026-08-28T04:59:59+09:00", win), "out");
});

test("日付が無い・壊れている記事は unknown（捨てずに区別する）", () => {
  const win = jstWindow(new Date("2026-08-28T20:40:00Z"));
  assert.equal(classifyDate(null, win), "unknown");
  assert.equal(classifyDate("", win), "unknown");
  assert.equal(classifyDate("きのう", win), "unknown");
});

test("label は日本語の窓表示（メール件名・レポート見出し用）", () => {
  const win = jstWindow(new Date("2026-08-28T20:40:00Z"));
  assert.equal(win.label, "2026-08-28 05:00 〜 2026-08-29 05:00 JST");
  assert.equal(win.dateLabel, "2026-08-29");
});
