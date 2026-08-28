// RSS 2.0 / RDF(RSS 1.0) / Atom / Shift_JIS / 空 / 壊れXML の6経路をfixtureで実証する。
// ネットワークには一切出ない（fetcherを注入する）。
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchFeed, decodeXml } from "../src/adapters/rss.js";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const raw = (name) => fs.readFileSync(path.join(FIX, name));

function fetcherOf(name, { contentType = "application/xml", status = 200 } = {}) {
  return async () => ({ ok: status === 200, status, body: raw(name), contentType });
}

const SOURCE = {
  id: "s1",
  name: "テスト元",
  url: "https://example.com/feed",
  priority: "A",
  region: "国内",
};

test("RSS 2.0 を正規化アイテムに変換する", async () => {
  const { items, itemCount, error } = await fetchFeed(SOURCE, { fetcher: fetcherOf("rss2.xml") });
  assert.equal(error, null);
  assert.equal(itemCount, 3);
  const first = items[0];
  assert.equal(first.title, "新型AIノートPCが国内発表、9月10日発売");
  assert.equal(first.url, "https://example.com/news/1?utm_source=rss&utm_medium=feed");
  assert.equal(first.source, "テスト元");
  assert.equal(first.sourcePriority, "A");
  assert.equal(first.publishedAt, "2026-08-28T01:00:00.000Z");
  assert.ok(first.summary.includes("NPU"));
  assert.equal(first.id.length, 16);
});

test("RDF(RSS 1.0・Impress系)の dc:date を拾える", async () => {
  const { items, error } = await fetchFeed(SOURCE, { fetcher: fetcherOf("rdf.xml") });
  assert.equal(error, null);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "次世代GPUが正式発表");
  assert.equal(items[0].publishedAt, "2026-08-28T03:00:00.000Z");
});

test("Atom の link@href と updated を拾える", async () => {
  const { items, error } = await fetchFeed(SOURCE, { fetcher: fetcherOf("atom.xml") });
  assert.equal(error, null);
  assert.equal(items[0].url, "https://www.gizmodo.jp/2026/08/foldable.html");
  assert.equal(items[0].publishedAt, "2026-08-28T06:30:00.000Z");
});

test("Shift_JIS のフィードが文字化けせずに読める", async () => {
  const { items, error } = await fetchFeed(SOURCE, { fetcher: fetcherOf("sjis.xml") });
  assert.equal(error, null);
  assert.equal(items[0].title, "ワイヤレスイヤホンの新製品が発売");
});

test("decodeXml は XML宣言の encoding を優先して読む", () => {
  const text = decodeXml(raw("sjis.xml"), "application/xml");
  assert.ok(text.includes("ワイヤレスイヤホン"));
});

test("空フィードは0件・エラーなしで返る（Digital Trends 対策）", async () => {
  const { items, itemCount, error } = await fetchFeed(SOURCE, { fetcher: fetcherOf("empty.xml") });
  assert.equal(error, null);
  assert.equal(itemCount, 0);
  assert.deepEqual(items, []);
});

test("壊れたXMLは例外を投げず error 文字列で返す", async () => {
  const { items, error } = await fetchFeed(SOURCE, { fetcher: fetcherOf("broken.xml") });
  assert.deepEqual(items, []);
  assert.ok(typeof error === "string" && error.length > 0);
});

test("HTTPエラーは例外を投げず error 文字列で返す", async () => {
  const { items, error } = await fetchFeed(SOURCE, {
    fetcher: fetcherOf("rss2.xml", { status: 404 }),
  });
  assert.deepEqual(items, []);
  assert.ok(error.includes("404"));
});

test("fetcher 自体が例外を投げても握りつぶして error にする", async () => {
  const { items, error } = await fetchFeed(SOURCE, {
    fetcher: async () => {
      throw new Error("ETIMEDOUT");
    },
  });
  assert.deepEqual(items, []);
  assert.ok(error.includes("ETIMEDOUT"));
});

test("pubDate が無い記事は publishedAt=null で残る（捨てない）", async () => {
  const { items } = await fetchFeed(SOURCE, { fetcher: fetcherOf("rss2.xml") });
  const noDate = items.find((i) => i.title === "日付のない記事");
  assert.equal(noDate.publishedAt, null);
});
