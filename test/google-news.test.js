// Googleニュース経由のソース（公式RSSが無い媒体の受け皿）。
// GetNavi web は 2026-08 時点で /feed/ 系がすべてトップページにリダイレクトされ、
// 記事タイトルを含む sitemap も無いため、この経路でしか取り込めない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchFeed } from "../src/adapters/rss.js";

const GOOGLE_NEWS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>"site:getnavi.jp" - Google ニュース</title>
<item>
  <title>RICOH GR IVx が出る！標準域をカバーするスナップシューター - GetNavi web</title>
  <link>https://news.google.com/rss/articles/CBMiTEFVX3lxTFAzYk93?oc=5</link>
  <pubDate>Thu, 27 Aug 2026 01:15:00 GMT</pubDate>
  <description>&lt;a href="https://news.google.com/rss/articles/CBMiTEFVX3lxTFAzYk93?oc=5" target="_blank"&gt;RICOH GR IVx が出る！&lt;/a&gt;&lt;font color="#6f6f6f"&gt;GetNavi web&lt;/font&gt;</description>
  <source url="https://getnavi.jp">GetNavi web</source>
</item>
</channel></rss>`;

const SOURCE = {
  id: "getnavi",
  name: "GetNavi web",
  url: "https://news.google.com/rss/search?q=site:getnavi.jp",
  priority: "B",
  region: "国内",
  via: "google-news",
};

const fetcher = async () => ({
  ok: true,
  status: 200,
  body: Buffer.from(GOOGLE_NEWS_XML, "utf-8"),
  contentType: "application/xml",
});

test("タイトル末尾の「 - 媒体名」を落とす（ソース名は別枠で出るため）", async () => {
  const { items } = await fetchFeed(SOURCE, { fetcher });
  assert.equal(items[0].title, "RICOH GR IVx が出る！標準域をカバーするスナップシューター");
});

test("descriptionはリンクのHTMLだけなので要約として渡さない", async () => {
  const { items } = await fetchFeed(SOURCE, { fetcher });
  assert.equal(items[0].summary, "", "リンクのマークアップを要約に混ぜてはいけない");
});

test("公開日時とリンクは通常どおり取れる", async () => {
  const { items } = await fetchFeed(SOURCE, { fetcher });
  assert.equal(items[0].publishedAt, "2026-08-27T01:15:00.000Z");
  assert.ok(items[0].url.startsWith("https://news.google.com/rss/articles/"));
  assert.equal(items[0].source, "GetNavi web");
});

test("via が無い通常のソースでは末尾を削らない", async () => {
  const { items } = await fetchFeed({ ...SOURCE, via: undefined }, { fetcher });
  assert.ok(items[0].title.endsWith("- GetNavi web"), "通常ソースのタイトルは加工しない");
  assert.ok(items[0].summary.length > 0, "通常ソースのdescriptionは要約として使う");
});
