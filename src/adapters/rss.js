// RSS 2.0 / RSS 1.0(RDF) / Atom を共通アイテム形式に正規化する。
// 1フィードの失敗で例外を投げない（呼び出し側は error 文字列を見る）。
// Impress系4本はRDF、GIZMODO JAPANはUTF-8以外が混ざることがあるため、
// 生バイトで取得してから文字コードを判定してパースする。
import Parser from "rss-parser";
import iconv from "iconv-lite";
import { makeId } from "../dedupe.js";

const USER_AGENT =
  "gadget-news-radar/0.1 (+https://github.com/groundcobra009/gadget-news-radar; personal daily digest)";
const TIMEOUT_MS = 20000;

// 文字コード名のゆれを iconv-lite が理解できる名前に寄せる
function canonicalCharset(name) {
  const lower = String(name || "").toLowerCase().replace(/["']/g, "").trim();
  if (!lower) return null;
  if (/^(shift[-_]?jis|sjis|x-sjis|windows-31j|cp932|ms_kanji)$/.test(lower)) return "Shift_JIS";
  if (/^(euc[-_]?jp|x-euc-jp)$/.test(lower)) return "EUC-JP";
  if (/^(iso[-_]?2022[-_]?jp)$/.test(lower)) return "ISO-2022-JP";
  if (/^(utf[-_]?8)$/.test(lower)) return "utf-8";
  if (/^(iso[-_]?8859[-_]?1|latin1)$/.test(lower)) return "latin1";
  return lower;
}

/**
 * 生バイト列を文字列に復号する。XML宣言の encoding を最優先し、次に Content-Type、
 * それも無ければ UTF-8 とみなす。
 * @param {Buffer|Uint8Array|string} body
 * @param {string} [contentType]
 * @returns {string}
 */
export function decodeXml(body, contentType) {
  if (typeof body === "string") return body;
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  // XML宣言はASCII互換の範囲に収まるので、先頭だけ latin1 で覗いて encoding を読む
  const head = buf.subarray(0, 256).toString("latin1");
  const declared = head.match(/<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i)?.[1];
  const fromHeader = String(contentType || "").match(/charset\s*=\s*([^;]+)/i)?.[1];
  const charset = canonicalCharset(declared) || canonicalCharset(fromHeader) || "utf-8";
  if (charset === "utf-8" || !iconv.encodingExists(charset)) {
    return buf.toString("utf-8");
  }
  return iconv.decode(buf, charset);
}

function toIso(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * rss-parser のパース結果を共通アイテム形式に変換する。
 * @param {object} feed
 * @param {{ id:string, name:string, priority:string, region:string }} source
 */
export function feedToItems(feed, source) {
  return (feed?.items ?? []).map((item) => {
    const url = item.link || item.guid || "";
    return {
      id: makeId(url),
      title: item.title || "",
      url,
      source: source.name,
      sourceId: source.id,
      sourcePriority: source.priority,
      sourceRegion: source.region,
      publishedAt: toIso(item.isoDate || item.pubDate || item.dcDate || item.date || item.updated),
      summary: item.contentSnippet || item.summary || item.content || item.description || "",
    };
  });
}

// 既定の取得関数。生バイトで返すのは文字コード判定を自前でやるため。
async function defaultFetcher(url) {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
  });
  return {
    ok: res.ok,
    status: res.status,
    body: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") ?? "",
  };
}

/**
 * 1ソースを取得してアイテム配列にする。例外は投げず、必ず { items, itemCount, error } を返す。
 * @param {object} source - feeds.yaml の1エントリ
 * @param {{ fetcher?: Function }} [options]
 */
export async function fetchFeed(source, { fetcher = defaultFetcher } = {}) {
  try {
    const res = await fetcher(source.url);
    if (!res || res.ok === false || (res.status && res.status !== 200)) {
      return { items: [], itemCount: 0, error: `HTTP ${res?.status ?? "不明"}` };
    }
    const xml = decodeXml(res.body, res.contentType);
    const parser = new Parser({
      customFields: { item: [["dc:date", "dcDate"]] },
    });
    const feed = await parser.parseString(xml);
    const items = feedToItems(feed, source);
    return { items, itemCount: feed?.items?.length ?? 0, error: null };
  } catch (err) {
    return { items: [], itemCount: 0, error: err?.message ? String(err.message) : String(err) };
  }
}
