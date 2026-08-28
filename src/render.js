// メール本文HTMLの生成。
// Gmail は <head> の <style> を落とすので、全要素にインラインstyleを書く。
// 外部リソース（link/script/img/webフォント/背景画像）は一切使わない —— 画像ブロックや
// ネットワーク制限に左右されず、開いた瞬間に読めることを最優先する。

const WARN = "#c0392b";
const INK = "#1c1c1c";
const MUTED = "#6b6b6b";
const LINE = "#e2e2e2";
const BG = "#ffffff";
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Segoe UI', sans-serif";

const STAR_SECTIONS = [
  { stars: 3, heading: "★★★ おすすめ", note: "今日のうちに動く価値があるもの" },
  { stars: 2, heading: "★★ 押さえておく", note: "急がないが知っておきたいもの" },
  { stars: 1, heading: "★ 参考", note: "一応目に入れておく程度", compact: true },
];

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ISO文字列を "08/28 10:00" のJST表記にする
function jstShort(iso) {
  if (!iso) return "日時不明";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "日時不明";
  const d = new Date(t + 9 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function heading(text, note) {
  return [
    `<tr><td style="padding:22px 0 6px 0;border-bottom:1px solid ${LINE};">`,
    `<span style="font-size:15px;font-weight:700;color:${INK};">${escapeHtml(text)}</span>`,
    note ? `<span style="font-size:11px;color:${MUTED};margin-left:8px;">${escapeHtml(note)}</span>` : "",
    "</td></tr>",
  ].join("");
}

// compact=true は★1用。件数が多くなりがちなので1行に畳んでメールの長さを抑える。
function articleRow(item, compact = false) {
  const meta = `${escapeHtml(item.source)} ・ ${escapeHtml(jstShort(item.publishedAt))}`;
  if (compact) {
    return [
      `<tr><td style="padding:7px 0;border-bottom:1px solid ${LINE};">`,
      `<a href="${escapeHtml(item.url)}" style="font-size:12px;line-height:1.5;color:#0b5ea8;text-decoration:none;">${escapeHtml(item.title)}</a>`,
      `<span style="font-size:10px;color:${MUTED};margin-left:6px;">${meta}</span>`,
      "</td></tr>",
    ].join("");
  }
  const reason = item.reason
    ? `<div style="font-size:12px;line-height:1.6;color:${INK};margin-top:4px;">${escapeHtml(item.reason)}</div>`
    : "";
  return [
    `<tr><td style="padding:12px 0;border-bottom:1px solid ${LINE};">`,
    `<a href="${escapeHtml(item.url)}" style="font-size:14px;font-weight:600;line-height:1.5;color:#0b5ea8;text-decoration:none;">${escapeHtml(item.title)}</a>`,
    `<div style="font-size:11px;color:${MUTED};margin-top:4px;">${meta}</div>`,
    reason,
    "</td></tr>",
  ].join("");
}

function emptyRow(text) {
  return `<tr><td style="padding:12px 0;font-size:12px;color:${MUTED};">${escapeHtml(text)}</td></tr>`;
}

/**
 * メール件名を組み立てる。未判定があれば件名の時点でわかるようにする。
 */
export function buildSubject({ window: win, items, unjudgedCount }) {
  const md = String(win?.dateLabel ?? "").slice(5).replace("-", "/");
  const top = (items ?? []).filter((i) => i.stars === 3).length;
  const total = (items ?? []).length;
  const warn = unjudgedCount > 0 ? `【未判定 ${unjudgedCount}件】` : "";
  return `${warn}【ガジェット】${md} の注目 ${top}本 ／ 全 ${total}本`;
}

/**
 * ダイジェスト本文HTMLを生成する。判定が欠けていても落ちず、欠けている事実を本文に出す。
 * @param {{ window:object, generatedAt:string, summary:string|null, items:Array<object>,
 *           sourceStatuses:Array<object>, unjudgedCount:number, stats:object }} input
 * @returns {string}
 */
export function renderEmailHtml({ window: win, generatedAt, summary, items, sourceStatuses, unjudgedCount, stats }) {
  const list = items ?? [];
  const rows = [];

  rows.push(
    `<tr><td style="padding:0 0 4px 0;"><span style="font-size:18px;font-weight:700;color:${INK};">ガジェットニュース ダイジェスト</span></td></tr>`,
    `<tr><td style="padding:0 0 8px 0;font-size:11px;color:${MUTED};">${escapeHtml(win?.label ?? "")} の24時間分</td></tr>`
  );

  if (unjudgedCount > 0) {
    rows.push(
      `<tr><td style="padding:10px 12px;border:1px solid ${WARN};color:${WARN};font-size:12px;line-height:1.6;">` +
        `${unjudgedCount}件の記事を判定できませんでした（未判定）。判定ステップが失敗している可能性があります。下の「未判定」欄を確認してください。` +
        "</td></tr>"
    );
  }

  rows.push(heading("今日の要約"));
  rows.push(
    summary
      ? `<tr><td style="padding:12px 0;font-size:13px;line-height:1.8;color:${INK};">${escapeHtml(summary)}</td></tr>`
      : emptyRow("要約はありません（判定ステップが要約を返しませんでした）。")
  );

  if (list.length === 0) {
    rows.push(emptyRow("該当する記事はありませんでした。"));
  }

  for (const section of STAR_SECTIONS) {
    const bucket = list.filter((i) => i.stars === section.stars);
    rows.push(heading(section.heading, section.note));
    if (bucket.length === 0) {
      rows.push(emptyRow("なし"));
    } else {
      for (const item of bucket) rows.push(articleRow(item, section.compact));
    }
  }

  const unjudged = list.filter((i) => i.stars === null);
  if (unjudged.length > 0) {
    rows.push(heading("未判定", "推奨度が付けられなかった記事"));
    for (const item of unjudged) rows.push(articleRow(item));
  }

  rows.push(heading("ソースの取得状況"));
  const failed = (sourceStatuses ?? []).filter((s) => !s.ok);
  if (failed.length === 0) {
    rows.push(emptyRow(`全${(sourceStatuses ?? []).length}ソースの取得に成功しました。`));
  } else {
    for (const s of failed) {
      rows.push(
        `<tr><td style="padding:6px 0;font-size:12px;color:${WARN};">${escapeHtml(s.name)}: ${escapeHtml(s.error ?? "取得失敗")}</td></tr>`
      );
    }
  }

  const statLine = stats
    ? `取得 ${stats.fetchedCount ?? stats.fetched ?? 0}件 → 24h内 ${stats.inWindowCount ?? stats.inWindow ?? 0}件 → 既出除外後 ${list.length}件` +
      (stats.truncated ? `（上限超過で ${stats.truncated}件を除外）` : "")
    : "";
  rows.push(
    `<tr><td style="padding:18px 0 0 0;border-top:1px solid ${LINE};font-size:11px;color:${MUTED};line-height:1.7;">` +
      `${escapeHtml(statLine)}<br>生成: ${escapeHtml(generatedAt ?? "")} / gadget-news-radar` +
      "</td></tr>"
  );

  return [
    `<div style="background:${BG};padding:16px;font-family:${FONT};">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">`,
    rows.join("\n"),
    "</table>",
    "</div>",
  ].join("\n");
}
