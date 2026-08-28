// judgments.json（GitHub Actions 上の Claude が書き出す判定結果）を候補にマージする契約層。
//
// この層の存在理由:
//   エージェント実行は非決定論的で、「何も書かない」「壊れたJSONを書く」「存在しない記事IDを
//   でっち上げる」が普通に起こる。それでもメールは必ず届き、判定が欠けていれば
//   「未判定」として本文に出る、というのがこのシステムの安全弁。
//   （設計は 001Area/bid-radar の src/judgments.js を踏襲）
//
// 契約:
//   { "summary": { "headline": "…", "lead": "…", "points": ["…"] },
//     "items": [ { "id": "<候補のid>", "stars": 1|2|3, "reason": "…" } ] }
//   - stars が整数の 1/2/3 以外 → 未判定（stars: null）
//   - candidates に無い id → 無視（幻の記事を混入させない）
//   - judgments に無い候補 → 未判定として残す（判定漏れを隠さない）
//   - ファイルが無い・壊れている → 全件未判定で続行（例外にしない）
import { sanitizeText } from "./sanitize.js";
import { normalizeSummary } from "./summary.js";

const REASON_MAX = 200;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {Array<object>} candidates - collect が出した候補（id必須）
 * @param {unknown} judgments - judgments.json の内容（何が来ても落ちない）
 * @returns {{ items: Array<object>, summary: string|null, unjudgedCount: number }}
 */
export function applyJudgments(candidates, judgments) {
  const root = isPlainObject(judgments) ? judgments : {};
  const list = Array.isArray(root.items) ? root.items : [];

  const byId = new Map();
  for (const j of list) {
    if (isPlainObject(j) && j.id !== undefined) byId.set(j.id, j);
  }

  let unjudgedCount = 0;
  const items = (candidates ?? []).map((candidate) => {
    const j = byId.get(candidate.id);
    const stars = j && Number.isInteger(j.stars) && j.stars >= 1 && j.stars <= 3 ? j.stars : null;
    if (stars === null) unjudgedCount += 1;
    const reason =
      stars !== null && typeof j.reason === "string" ? sanitizeText(j.reason, REASON_MAX) : null;
    return { ...candidate, stars, reason };
  });

  const summary = normalizeSummary(root.summary);
  return { items, summary, unjudgedCount };
}
