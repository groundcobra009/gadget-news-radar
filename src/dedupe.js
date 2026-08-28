// URL正規化と送信済み突合。毎朝の重複配信を防ぐ最後の砦。
// （出典: miraichi-20250803-github-actions-info-collector の src/utils/deduplicate.js を移植・makeIdを追加）
import fs from "node:fs";
import crypto from "node:crypto";

const TRACKING_PREFIXES = ["utm_"];
const TRACKING_EXACT = ["gclid", "fbclid", "ref", "ref_src", "mc_cid", "mc_eid"];

/**
 * 比較用にURLを正規化する（ハッシュ除去・末尾スラッシュ除去・計測パラメータ除去・ホスト小文字化）。
 * URLとして解釈できない場合は元の文字列を返す（落とさない）。
 * @param {string|null|undefined} url
 * @returns {string}
 */
export function normalizeUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (TRACKING_PREFIXES.some((p) => lower.startsWith(p)) || TRACKING_EXACT.includes(lower)) {
        u.searchParams.delete(key);
      }
    }
    u.hostname = u.hostname.toLowerCase();
    let pathname = u.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    const search = u.searchParams.toString();
    return `${u.protocol}//${u.hostname}${pathname}${search ? `?${search}` : ""}`;
  } catch {
    return String(url);
  }
}

/**
 * 正規化後URLから安定した16桁のIDを作る。
 * 判定結果(judgments.json)との突合キーになるので、同じ記事は常に同じIDになること。
 * @param {string} url
 * @returns {string}
 */
export function makeId(url) {
  return crypto.createHash("sha1").update(normalizeUrl(url)).digest("hex").slice(0, 16);
}

/** 処理済みアイテムのJSONを読む。ファイルが無い・壊れていても空として返す（落ちない）。 */
export function loadProcessed(filePath, log) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!parsed || !Array.isArray(parsed.items)) {
      log?.warn?.(`processed-itemsの形式が不正です: ${filePath}`);
      return { items: [] };
    }
    return parsed;
  } catch {
    return { items: [] };
  }
}

/** items のうち processed に未登録（URL正規化して比較）のものだけを返す */
export function filterNew(items, processed) {
  const seen = new Set((processed?.items ?? []).map((i) => normalizeUrl(i.url)));
  return items.filter((item) => !seen.has(normalizeUrl(item.url)));
}

/** 新しいアイテムを積み、新しい順に limit 件まで切り詰めた「新しいオブジェクト」を返す */
export function addProcessed(items, processed, limit = 1500) {
  const now = new Date().toISOString();
  const newRecords = items.map((item) => ({ url: item.url, title: item.title, processedAt: now }));
  return { items: [...newRecords, ...(processed?.items ?? [])].slice(0, limit) };
}

/** processed を JSON ファイルに保存する */
export function saveProcessed(filePath, processed) {
  fs.writeFileSync(filePath, `${JSON.stringify(processed, null, 2)}\n`);
}
