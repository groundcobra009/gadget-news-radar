// URL正規化と送信済み突合（毎朝の重複配信を防ぐ最後の砦）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, makeId, filterNew, addProcessed } from "../src/dedupe.js";

test("計測用パラメータを除去する", () => {
  assert.equal(
    normalizeUrl("https://example.com/a?utm_source=rss&utm_medium=feed&id=7"),
    "https://example.com/a?id=7"
  );
  assert.equal(normalizeUrl("https://example.com/a?gclid=x"), "https://example.com/a");
  assert.equal(normalizeUrl("https://example.com/a?fbclid=x"), "https://example.com/a");
  assert.equal(normalizeUrl("https://example.com/a?ref=twitter"), "https://example.com/a");
});

test("ハッシュ・末尾スラッシュ・ホスト大文字を吸収する", () => {
  assert.equal(normalizeUrl("https://Example.com/a/#top"), "https://example.com/a");
  assert.equal(normalizeUrl("https://example.com/a/"), "https://example.com/a");
});

test("ルートの単独スラッシュは残す", () => {
  assert.equal(normalizeUrl("https://example.com/"), "https://example.com/");
});

test("URLとして壊れていても落とさない", () => {
  assert.equal(normalizeUrl("not a url"), "not a url");
  assert.equal(normalizeUrl(""), "");
  assert.equal(normalizeUrl(null), "");
});

test("makeId は正規化後URLから決まる（見た目違いでも同じID）", () => {
  const a = makeId("https://example.com/a?utm_source=rss");
  const b = makeId("https://example.com/a/");
  assert.equal(a, b);
  assert.equal(a.length, 16);
  assert.notEqual(a, makeId("https://example.com/b"));
});

test("送信済みURLの記事は除外される（見た目が違っても）", () => {
  const processed = { items: [{ url: "https://example.com/a" }] };
  const items = [
    { url: "https://example.com/a?utm_source=rss", title: "既出" },
    { url: "https://example.com/b", title: "新着" },
  ];
  const fresh = filterNew(items, processed);
  assert.deepEqual(fresh.map((i) => i.title), ["新着"]);
});

test("addProcessed は新しい順に積み、上限で切り詰める（元を壊さない）", () => {
  const processed = { items: [{ url: "https://example.com/old" }] };
  const next = addProcessed([{ url: "https://example.com/new", title: "n" }], processed, 1);
  assert.equal(next.items.length, 1);
  assert.equal(next.items[0].url, "https://example.com/new");
  assert.equal(processed.items.length, 1, "元のオブジェクトは変更しない");
});
