#!/usr/bin/env node
// `npm run render` — candidates × judgments をマージして out/report-YYYY-MM-DD.html を書く。
// judgments.json が無くても壊れていても落ちない（全件「未判定」で描画する）。
import fs from "node:fs";
import path from "node:path";
import { applyJudgments } from "./judgments.js";
import { renderEmailHtml, buildSubject } from "./render.js";
import {
  CANDIDATES_PATH,
  JUDGMENTS_PATH,
  OUT_DIR,
  ensureDirs,
  readJsonOrNull,
  writeJson,
} from "./config.js";

function main() {
  ensureDirs();
  const collected = readJsonOrNull(CANDIDATES_PATH);
  if (!collected) {
    throw new Error(`${CANDIDATES_PATH} がありません。先に npm run collect を実行してください`);
  }

  const judgments = readJsonOrNull(JUDGMENTS_PATH);
  if (judgments === null) {
    console.warn("警告: out/judgments.json がありません。全件を「未判定」として描画します。");
  }

  const statuses = readJsonOrNull(path.join(OUT_DIR, "source-status.json"))?.sourceStatuses ?? [];
  const { items, summary, unjudgedCount } = applyJudgments(collected.candidates ?? [], judgments);

  const view = {
    window: collected.window,
    generatedAt: new Date().toISOString(),
    summary,
    items,
    sourceStatuses: statuses,
    unjudgedCount,
    stats: collected.stats,
  };

  const html = renderEmailHtml(view);
  const subject = buildSubject(view);
  const dateLabel = collected.window?.dateLabel ?? "unknown";
  const htmlPath = path.join(OUT_DIR, `report-${dateLabel}.html`);

  fs.writeFileSync(htmlPath, html);
  writeJson(path.join(OUT_DIR, "digest.json"), { subject, htmlPath, unjudgedCount, itemCount: items.length });

  console.log(`件名: ${subject}`);
  console.log(`本文: ${htmlPath}（${items.length}件・未判定 ${unjudgedCount}件）`);
}

try {
  main();
} catch (err) {
  console.error(`render が異常終了しました: ${err.message}`);
  process.exit(1);
}
