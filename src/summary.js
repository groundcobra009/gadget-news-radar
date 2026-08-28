// judgments.json の summary を正規化する。
//
// LLMには { headline, lead, points[] } の形で書かせるが、型は信用しない。
// 旧仕様（ただの文字列）で来ても壊れないよう、文字列は lead として受ける。
import { sanitizeText } from "./sanitize.js";

const HEADLINE_MAX = 60;
const LEAD_MAX = 400;
const POINT_MAX = 120;
const POINTS_MAX_COUNT = 6;

function cleanString(value, max) {
  if (typeof value !== "string") return null;
  const text = sanitizeText(value, max);
  return text.length > 0 ? text : null;
}

/**
 * @param {unknown} raw - judgments.json の summary フィールド
 * @returns {{ headline: string|null, lead: string|null, points: string[] }|null}
 *          何も取れなければ null
 */
export function normalizeSummary(raw) {
  if (typeof raw === "string") {
    const lead = cleanString(raw, LEAD_MAX);
    return lead ? { headline: null, lead, points: [] } : null;
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;

  const headline = cleanString(raw.headline, HEADLINE_MAX);
  const lead = cleanString(raw.lead, LEAD_MAX);
  const points = (Array.isArray(raw.points) ? raw.points : [])
    .map((p) => cleanString(p, POINT_MAX))
    .filter(Boolean)
    .slice(0, POINTS_MAX_COUNT);

  if (!headline && !lead && points.length === 0) return null;
  return { headline, lead, points };
}
