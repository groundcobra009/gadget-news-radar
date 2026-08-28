#!/usr/bin/env node
// `npm run collect` — 26フィードを巡回して out/candidates.json と out/source-status.json を書く。
// ここまでは完全に決定論的。LLMは一切呼ばない。
import { collectAll } from "./collect.js";
import { loadProcessed } from "./dedupe.js";
import { toJudgeInput } from "./judge-input.js";
import {
  CANDIDATES_PATH,
  OUT_DIR,
  PROCESSED_PATH,
  ensureDirs,
  loadFeeds,
  loadKeywordGroups,
  writeJson,
} from "./config.js";
import path from "node:path";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
// --max N: 動作確認用に候補数を絞る（本番は既定値を使う）
const maxIndex = argv.indexOf("--max");
const maxCandidates = maxIndex >= 0 ? Number(argv[maxIndex + 1]) : undefined;

async function main() {
  ensureDirs();
  const sources = loadFeeds();
  const keywordGroups = loadKeywordGroups();
  const processed = loadProcessed(PROCESSED_PATH);

  const { candidates, sourceStatuses, window: win, stats } = await collectAll({
    sources,
    keywordGroups,
    processed,
    ...(Number.isFinite(maxCandidates) ? { maxCandidates } : {}),
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    window: { startIso: win.startIso, endIso: win.endIso, label: win.label, dateLabel: win.dateLabel },
    stats,
    candidates,
  };

  writeJson(CANDIDATES_PATH, payload);
  writeJson(path.join(OUT_DIR, "source-status.json"), { generatedAt: payload.generatedAt, sourceStatuses });
  // LLMにはこの絞り込み版だけを読ませる（candidates.json は読ませない）
  writeJson(path.join(OUT_DIR, "judge-input.json"), toJudgeInput(candidates));

  const failed = sourceStatuses.filter((s) => !s.ok);
  console.log(`窓: ${win.label}`);
  console.log(
    `取得 ${stats.fetchedCount}件 → 24h内 ${stats.inWindowCount}件 → 既出除外 ${stats.dedupedCount}件 → 候補 ${stats.candidateCount}件` +
      (stats.truncated ? `（上限超過 ${stats.truncated}件を除外）` : "")
  );
  console.log(`ソース: 成功 ${sourceStatuses.length - failed.length} / 失敗 ${failed.length}`);
  for (const s of failed) console.log(`  ✗ ${s.name}: ${s.error}`);
  if (dryRun) console.log("（--dry-run: 書き出しのみ・後続は実行しません）");
}

main().catch((err) => {
  console.error(`collect が異常終了しました: ${err.message}`);
  process.exit(1);
});
