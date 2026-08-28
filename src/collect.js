// 全ソース巡回 → 24時間窓で絞る → 既出除外 → スコア付け → 上限で切る。
// 1ソースの失敗で全体を止めない（try/catchで隔離し、落ちた事実は sourceStatuses に必ず残す）。
// 設計は 001Area/bid-radar の src/collect.js を踏襲。
import { fetchFeed } from "./adapters/rss.js";
import { jstWindow, classifyDate } from "./window.js";
import { filterNew } from "./dedupe.js";
import { scoreItem } from "./filter.js";
import { sanitizeCandidate } from "./sanitize.js";

const DEFAULT_MAX_CANDIDATES = 250;

/**
 * @param {object} params
 * @param {Array<object>} params.sources - feeds.yaml の内容
 * @param {Array<object>} params.keywordGroups - keywords.yaml の内容
 * @param {Date} [params.now] - 窓の基準時刻（テスト用）
 * @param {Function} [params.fetcher] - 取得関数（テスト差し替え用）
 * @param {{items:Array<{url:string}>}} [params.processed] - 送信済み記録
 * @param {number} [params.maxCandidates] - LLMに渡す上限件数
 */
export async function collectAll({
  sources,
  keywordGroups,
  now = new Date(),
  fetcher,
  processed = { items: [] },
  maxCandidates = DEFAULT_MAX_CANDIDATES,
}) {
  const win = jstWindow(now);
  const sourceStatuses = [];
  const collected = [];
  let fetchedCount = 0;

  for (const source of sources ?? []) {
    if (!source.enabled) continue;
    const fetchedAt = new Date().toISOString();
    const base = {
      sourceId: source.id,
      name: source.name,
      region: source.region ?? null,
      priority: source.priority ?? null,
      fetchedAt,
    };

    let result;
    try {
      result = await fetchFeed(source, { fetcher });
    } catch (err) {
      // fetchFeed は本来例外を投げないが、想定外でも1ソースで全体を止めない
      result = { items: [], itemCount: 0, error: `想定外のエラー: ${err.message}` };
    }

    if (result.error) {
      sourceStatuses.push({
        ...base,
        ok: false,
        itemCount: 0,
        inWindowCount: 0,
        outOfWindowCount: 0,
        unknownDateCount: 0,
        error: result.error,
      });
      continue;
    }

    fetchedCount += result.itemCount;
    let inWindowCount = 0;
    let outOfWindowCount = 0;
    let unknownDateCount = 0;

    for (const item of result.items) {
      const cls = classifyDate(item.publishedAt, win);
      if (cls === "in") {
        inWindowCount += 1;
        collected.push({ ...item, dateUnknown: false });
      } else if (cls === "unknown") {
        // 日付が取れない記事は捨てない。重複配信は processed 側で防げる
        unknownDateCount += 1;
        collected.push({ ...item, dateUnknown: true });
      } else {
        outOfWindowCount += 1;
      }
    }

    sourceStatuses.push({
      ...base,
      ok: true,
      itemCount: result.itemCount,
      inWindowCount,
      outOfWindowCount,
      unknownDateCount,
      error: null,
    });
  }

  const beforeDedupe = collected.length;
  const fresh = filterNew(collected, processed);
  const dedupedCount = beforeDedupe - fresh.length;

  const scored = fresh
    .map((item) => ({ ...item, ...scoreItem(item, keywordGroups) }))
    .sort((a, b) => b.score - a.score || String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? "")));

  const truncated = Math.max(0, scored.length - maxCandidates);
  const candidates = scored.slice(0, maxCandidates).map(sanitizeCandidate);

  return {
    candidates,
    sourceStatuses,
    window: win,
    stats: {
      fetchedCount,
      inWindowCount: beforeDedupe,
      dedupedCount,
      truncated,
      candidateCount: candidates.length,
    },
  };
}
