// LLMに渡す前のサニタイズ。
// RSSの見出し・概要は第三者が書いた未検証テキストなので、タグ偽装・指示注入・巨大入力を
// 物理的に潰してから渡す（多層防御の1層目。2層目はワークフローの allowedTools 制限、
// 3層目は judgments.js の契約検証）。
// 手口は japan-news-frontpage-index の src/processors/summarizer.py を参考にしている。

const TITLE_MAX = 200;
const SUMMARY_MAX = 400;
// 改行・タブは空白畳みで扱うのでここでは残す
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * 山括弧を全角化し、制御文字を除き、空白を1つに畳み、長さを切り詰める。
 * @param {unknown} value
 * @param {number} [maxLength]
 * @returns {string}
 */
export function sanitizeText(value, maxLength = SUMMARY_MAX) {
  if (value === null || value === undefined) return "";
  const collapsed = String(value)
    .replace(CONTROL_RE, "")
    .replace(/</g, "＜")
    .replace(/>/g, "＞")
    .replace(/\s+/g, " ")
    .trim();
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength)}…` : collapsed;
}

/**
 * 候補1件をLLMに渡せる形に整える。
 * url と id は判定結果の突合キーなので絶対に変えない。
 */
export function sanitizeCandidate(candidate) {
  return {
    ...candidate,
    title: sanitizeText(candidate.title, TITLE_MAX),
    summary: sanitizeText(candidate.summary, SUMMARY_MAX),
  };
}
