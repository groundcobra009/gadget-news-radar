// LLM（GitHub Actions 上の Claude）に渡す入力だけを切り出す層。
// candidates.json をそのまま読ませず、判定に必要な5項目に絞る。
//   - トークンを減らす
//   - スコアや内部IDなど、判定を歪めうる情報を見せない
//   - インジェクションの攻撃面を減らす（渡すのはサニタイズ済みの文字列だけ）
const ALLOWED_KEYS = ["id", "title", "source", "publishedAt", "summary"];

/**
 * 判定用の最小入力に変換する。ここに無いキーは渡らない。
 * @param {Array<object>} candidates
 * @returns {Array<{id:string,title:string,source:string,publishedAt:string|null,summary:string}>}
 */
export function toJudgeInput(candidates) {
  return (candidates ?? []).map((c) => {
    const slim = {};
    for (const key of ALLOWED_KEYS) slim[key] = c[key] ?? null;
    return slim;
  });
}

export { ALLOWED_KEYS };
