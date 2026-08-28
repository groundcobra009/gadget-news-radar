// 他のリポジトリが読むための機械可読な書き出し。
//
// 用途: x-viral-drafts（AIバズ投稿ドラフト台帳）の候補収集。
//   向こうは runner/news_rss.py でAI系3フィード+Hacker Newsを直接叩いているが、
//   こちらは27ソースを24時間窓・重複除去・スコアリング・LLM判定まで済ませてある。
//   その結果を渡せば、向こうは「候補を集める」工程を省いて「絞る」から始められる。
//
// 置き場: out/latest.json（固定パス・毎日上書き）。このリポジトリはpublicなので
//   https://raw.githubusercontent.com/groundcobra009/gadget-news-radar/main/out/latest.json
//   で認証なしに読める。読む側はGitHub Actions でもMac miniでも同じURLで済む。
//
// 方針: フィルタは読む側の仕事。ここでは判定結果を全件そのまま出し、
//   絞り込みに使える材料（stars / score / groups / region）を添える。

const ITEM_KEYS = ["id", "title", "url", "source", "region", "publishedAt", "stars", "reason", "score", "groups"];

/**
 * @param {{ window:object, generatedAt:string, items:Array<object>, summary:object|null }} input
 * @returns {object} out/latest.json に書く内容
 */
export function buildExport({ window: win, generatedAt, items, summary }) {
  const list = items ?? [];
  const exported = list
    .map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      source: item.source,
      region: item.sourceRegion ?? null,
      publishedAt: item.publishedAt ?? null,
      stars: item.stars ?? null,
      reason: item.reason ?? null,
      score: item.score ?? null,
      // keywords.yaml のどのグループに当たったか。読む側がAI系だけ抜くのに使う
      groups: Array.isArray(item.matchedGroups) ? item.matchedGroups : [],
    }))
    .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || (b.score ?? 0) - (a.score ?? 0));

  return {
    producer: "gadget-news-radar",
    schemaVersion: 1,
    generatedAt: generatedAt ?? null,
    window: win
      ? { startIso: win.startIso, endIso: win.endIso, label: win.label, dateLabel: win.dateLabel }
      : null,
    summary: summary ?? null,
    counts: {
      total: exported.length,
      stars3: exported.filter((i) => i.stars === 3).length,
      stars2: exported.filter((i) => i.stars === 2).length,
      stars1: exported.filter((i) => i.stars === 1).length,
      unjudged: exported.filter((i) => i.stars === null).length,
    },
    items: exported,
  };
}

export { ITEM_KEYS };
