// 24時間窓（JST 05:00 固定境界）。
// GitHub Actions の schedule は混雑時に数分〜数十分遅れる。実行時刻から24時間を引くと
// 遅延のたびに窓がずれて「穴」や「重複」が出るため、窓は必ず固定境界で切る。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000; // JSTはUTC+9固定（サマータイムなし）
const BOUNDARY_HOUR = 5; // 毎朝5時が窓の境目
const DAY_MS = 24 * 60 * 60 * 1000;

function toMs(value) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

// エポックミリ秒を "YYYY-MM-DD HH:mm"（JST表記）にする
function formatJst(ms) {
  const d = new Date(ms + JST_OFFSET_MS);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/**
 * 実行時刻を含む「直近に閉じた」24時間窓 [前日05:00 JST, 当日05:00 JST) を返す。
 * 05:00より前に手動実行した場合は1つ前の窓になる（未来を含む窓は作らない）。
 * @param {Date|string|number} [now] - 基準時刻（省略時は現在時刻）
 * @returns {{ startMs:number, endMs:number, startIso:string, endIso:string, label:string, dateLabel:string }}
 */
export function jstWindow(now = new Date()) {
  const nowMs = toMs(now);
  // 「JSTの5時」を日付境界とみなすために、JSTへ寄せてさらに5時間戻した軸で日を数える
  const shifted = nowMs + JST_OFFSET_MS - BOUNDARY_HOUR * 60 * 60 * 1000;
  const dayIndex = Math.floor(shifted / DAY_MS);
  const endMs = dayIndex * DAY_MS + BOUNDARY_HOUR * 60 * 60 * 1000 - JST_OFFSET_MS;
  const startMs = endMs - DAY_MS;
  const endJst = new Date(endMs + JST_OFFSET_MS);
  const p = (n) => String(n).padStart(2, "0");
  return {
    startMs,
    endMs,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    label: `${formatJst(startMs)} 〜 ${formatJst(endMs)} JST`,
    dateLabel: `${endJst.getUTCFullYear()}-${p(endJst.getUTCMonth() + 1)}-${p(endJst.getUTCDate())}`,
  };
}

/**
 * 記事の公開日時が窓の内か外か、そもそも不明かを返す。
 * 開始は含み、終了は含まない（05:00:00 ちょうどの記事は翌窓に回す）。
 * 日付が無い・壊れている記事は捨てずに "unknown" として区別する
 * （重複配信は processed-items.json 側で防ぐので、拾いすぎても実害がない）。
 * @param {string|null|undefined} publishedAt - ISO文字列など
 * @param {{ startMs:number, endMs:number }} win
 * @returns {"in"|"out"|"unknown"}
 */
export function classifyDate(publishedAt, win) {
  if (!publishedAt) return "unknown";
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return "unknown";
  return t >= win.startMs && t < win.endMs ? "in" : "out";
}
