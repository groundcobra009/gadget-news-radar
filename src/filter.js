// キーワードスコアリング。
// bid-radar と違い「マッチしない記事を捨てる」ためのものではない。想定外の大ニュースを
// 取りこぼさないため、鮮度を満たす記事は全部候補に残し、ここは並び順だけを決める。
// （マッチ規則は 001Area/bid-radar の src/filter.js を移植）

const ASCII_WORD_RE = /^[A-Za-z0-9]+$/;
const PRIORITY_WEIGHT = { A: 2, B: 1 };

function buildMatcher(keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (ASCII_WORD_RE.test(keyword)) {
    // 英数字のみのキーワードは単語境界でマッチ（"SAIL" に "AI" が当たる誤爆を避ける）
    return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "i");
  }
  // 日本語等を含むキーワードは単純な部分一致（大文字小文字無視）
  return new RegExp(escaped, "i");
}

/**
 * タイトル・本文に keywords.yaml のグループをマッチさせる。weight は負でもよい（減点グループ）。
 * @param {{ title?: string, description?: string, summary?: string }} item
 * @param {Array<{ name: string, weight: number, keywords: string[] }>} groups
 * @returns {{ matchedKeywords: string[], matchedGroups: string[], score: number }}
 */
export function matchKeywords(item, groups) {
  const text = `${item.title ?? ""}\n${item.description ?? item.summary ?? ""}`;
  const matchedKeywords = [];
  const matchedGroups = [];
  let score = 0;

  for (const group of groups ?? []) {
    let groupMatched = false;
    for (const keyword of group.keywords ?? []) {
      if (buildMatcher(keyword).test(text)) {
        matchedKeywords.push(keyword);
        groupMatched = true;
      }
    }
    if (groupMatched) {
      matchedGroups.push(group.name);
      score += group.weight;
    }
  }

  return { matchedKeywords, matchedGroups, score };
}

/**
 * キーワードスコアにソース優先度（A=2 / B=1）を足した最終スコアを返す。
 * キーワードが1つも当たらなくてもスコアは0にならない（＝候補から消えない）。
 */
export function scoreItem(item, groups) {
  const matched = matchKeywords(item, groups);
  const base = PRIORITY_WEIGHT[item.sourcePriority] ?? 1;
  return { ...matched, score: base + matched.score };
}
