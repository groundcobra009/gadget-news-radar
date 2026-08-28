// メール本文HTMLの契約。
// Gmail は <style> を落とすので全要素インラインstyle、外部リソース参照はゼロにする。
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderEmailHtml, buildSubject } from "../src/render.js";
import { jstWindow } from "../src/window.js";

const WIN = jstWindow(new Date("2026-08-28T20:40:00Z"));

const BASE = {
  window: WIN,
  generatedAt: "2026-08-29T05:02:00+09:00",
  summary: {
    headline: "Googleの発表が集中した一日",
    lead: "本日はAIノートPCの国内発表が中心。価格と発売日が判明した。",
    points: ["Gemini 3.5 Transcribeが公開", "Galaxy S26 FEが約11万円から"],
  },
  items: [
    {
      id: "a",
      title: "新型AIノートPCが国内発表",
      url: "https://example.com/a",
      source: "ITmedia NEWS",
      publishedAt: "2026-08-28T01:00:00.000Z",
      score: 7,
      stars: 3,
      reason: "9月10日発売・価格も判明",
    },
    {
      id: "b",
      title: "次世代GPUが正式発表",
      url: "https://example.com/b",
      source: "PC Watch",
      publishedAt: "2026-08-28T03:00:00.000Z",
      score: 5,
      stars: 2,
      reason: "推論性能2倍",
    },
    {
      id: "c",
      title: "折りたたみの噂",
      url: "https://example.com/c",
      source: "すまほん!!",
      publishedAt: "2026-08-28T06:00:00.000Z",
      score: 1,
      stars: 1,
      reason: null,
    },
  ],
  sourceStatuses: [
    { sourceId: "itmedia-news", name: "ITmedia NEWS", ok: true, itemCount: 20, error: null },
    { sourceId: "digital-trends", name: "Digital Trends", ok: false, itemCount: 0, error: "HTTP 404" },
  ],
  unjudgedCount: 0,
  stats: { fetched: 120, inWindow: 40, afterDedupe: 30, sentToLlm: 30, truncated: 0 },
};

test("必須セクションが揃っている", () => {
  const html = renderEmailHtml(BASE);
  for (const heading of ["今日の要約", "★★★ おすすめ", "★★ 押さえておく", "★ 参考", "ソースの取得状況"]) {
    assert.ok(html.includes(heading), `見出し「${heading}」が無い`);
  }
});

test("外部リソースを一切読み込まない（Gmail対策）", () => {
  const html = renderEmailHtml(BASE);
  assert.ok(!/<link\b/i.test(html), "<link> があってはいけない");
  assert.ok(!/<script\b/i.test(html), "<script> があってはいけない");
  assert.ok(!/<img\b/i.test(html), "<img> があってはいけない");
  assert.ok(!/@import/i.test(html), "@import があってはいけない");
  assert.ok(!/url\(/i.test(html), "CSSのurl() があってはいけない");
});

test("<style>ブロックを使わず、インラインstyleで組む", () => {
  const html = renderEmailHtml(BASE);
  assert.ok(!/<style\b/i.test(html), "<style> はGmailに落とされるので使わない");
  assert.ok(html.includes('style="'), "インラインstyleが無い");
});

test("記事タイトルと理由はHTMLエスケープされる", () => {
  const html = renderEmailHtml({
    ...BASE,
    items: [{ ...BASE.items[0], title: "<script>x</script>&", reason: "a<b" }],
  });
  assert.ok(!html.includes("<script>x</script>"));
  assert.ok(html.includes("&lt;script&gt;x&lt;/script&gt;&amp;"));
  assert.ok(html.includes("a&lt;b"));
});

test("記事リンクは元URLのまま href に入る", () => {
  const html = renderEmailHtml(BASE);
  assert.ok(html.includes('href="https://example.com/a"'));
});

test("未判定があると赤い警告バナーが出る（無言の失敗を可視化する）", () => {
  const withUnjudged = renderEmailHtml({
    ...BASE,
    items: [...BASE.items, { id: "d", title: "判定漏れ", url: "https://example.com/d", source: "X", publishedAt: null, score: 2, stars: null, reason: null }],
    unjudgedCount: 1,
  });
  assert.ok(withUnjudged.includes("未判定"), "未判定セクションが無い");
  assert.ok(withUnjudged.includes("#c0392b"), "警告色が使われていない");
});

test("未判定が0件のときは警告バナーを出さない", () => {
  const html = renderEmailHtml(BASE);
  assert.ok(!html.includes("判定できませんでした"));
});

test("取得に失敗したソースは理由つきで出す（黙って消さない）", () => {
  const html = renderEmailHtml(BASE);
  assert.ok(html.includes("Digital Trends"));
  assert.ok(html.includes("HTTP 404"));
});

test("記事が0件でも落ちず、その旨を出す", () => {
  const html = renderEmailHtml({ ...BASE, items: [], summary: null, unjudgedCount: 0 });
  assert.ok(html.includes("該当する記事はありませんでした"));
});

test("要約は見出し・リード・箇条書きの3層で出る", () => {
  const html = renderEmailHtml(BASE);
  assert.ok(html.includes("Googleの発表が集中した一日"), "見出しが無い");
  assert.ok(html.includes("価格と発売日が判明した"), "リードが無い");
  assert.ok(html.includes("Gemini 3.5 Transcribeが公開"), "箇条書きが無い");
  assert.ok(html.includes("Galaxy S26 FEが約11万円から"), "箇条書き2件目が無い");
});

test("要約が無いときはその旨を出す（黙って空欄にしない）", () => {
  const html = renderEmailHtml({ ...BASE, summary: null });
  assert.ok(html.includes("要約はありません"));
});

test("要約の見出し・箇条書きもHTMLエスケープされる", () => {
  const html = renderEmailHtml({
    ...BASE,
    summary: { headline: "<b>見出し</b>", lead: null, points: ["a<b>c"] },
  });
  assert.ok(!html.includes("<b>見出し</b>"));
  assert.ok(html.includes("&lt;b&gt;見出し&lt;/b&gt;"));
  assert.ok(html.includes("a&lt;b&gt;c"));
});

test("buildSubject は日付・★★★件数・全件数を含む", () => {
  const s = buildSubject(BASE);
  assert.ok(s.includes("08/29"));
  assert.ok(s.includes("1"), "★★★の件数");
  assert.ok(s.includes("3"), "全件数");
});

test("buildSubject は未判定があるとその旨を件名に出す", () => {
  const s = buildSubject({ ...BASE, unjudgedCount: 2 });
  assert.ok(s.includes("未判定"));
});
