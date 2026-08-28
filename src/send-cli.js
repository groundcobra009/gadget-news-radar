#!/usr/bin/env node
// `npm run send` — 生成済みHTMLをResendで送り、送信できた記事を processed-items.json に記録する。
// --dry-run では Resend を一切呼ばず、payloadの要約だけを出す。
import fs from "node:fs";
import path from "node:path";
import { sendDigest } from "./mailer.js";
import { addProcessed, loadProcessed, saveProcessed } from "./dedupe.js";
import { shouldRecordAsSent } from "./send-policy.js";
import { CANDIDATES_PATH, OUT_DIR, PROCESSED_PATH, readJsonOrNull } from "./config.js";

const dryRun = process.argv.slice(2).includes("--dry-run");

async function main() {
  const digest = readJsonOrNull(path.join(OUT_DIR, "digest.json"));
  if (!digest) throw new Error("out/digest.json がありません。先に npm run render を実行してください");

  const html = fs.readFileSync(digest.htmlPath, "utf-8");
  const from = process.env.MAIL_FROM;
  const to = process.env.MAIL_TO;

  const result = await sendDigest({ from, to, subject: digest.subject, html }, { dryRun });

  if (dryRun) {
    console.log("--dry-run: 送信しません");
    console.log(`  from   : ${result.payload.from}`);
    console.log(`  to     : ${result.payload.to.join(", ")}`);
    console.log(`  subject: ${result.payload.subject}`);
    console.log(`  html   : ${html.length} bytes`);
    return;
  }

  console.log(`送信しました（Resend id: ${result.id}）`);

  // 送信できたときだけ既出として記録する（送信前に記録すると、失敗した記事が永久に届かなくなる）。
  // ただし判定が全滅した回は記録しない（翌日に判定つきでもう一度届けるため）。
  const { record, reason } = shouldRecordAsSent(digest);
  if (!record) {
    console.log(`既出記録は更新しません: ${reason}`);
    return;
  }
  const collected = readJsonOrNull(CANDIDATES_PATH);
  const sentItems = collected?.candidates ?? [];
  const processed = loadProcessed(PROCESSED_PATH);
  saveProcessed(PROCESSED_PATH, addProcessed(sentItems, processed));
  console.log(`既出記録に ${sentItems.length}件を追加しました`);
}

main().catch((err) => {
  console.error(`send が異常終了しました: ${err.message}`);
  process.exit(1);
});
