#!/usr/bin/env node
// ゴールコマンド（`npm run goal`）。
// test → 実フィード収集 → judgments無しでのrender → HTML検証 → send --dry-run を通しで実行し、
// すべてOKならexit 0。「完成したか」をこのコマンド1本で機械判定する。
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { CANDIDATES_PATH, OUT_DIR, REPO_ROOT, readJsonOrNull } from "./config.js";

function run(cmd, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

/**
 * 生成HTMLがメール本文として成立しているかを検証する（ユニットテストから使えるよう分離）。
 * @param {string} html
 * @param {number} itemCount
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function validateDigestHtml(html, itemCount) {
  const reasons = [];
  for (const heading of ["今日の要約", "★★★ おすすめ", "★★ 押さえておく", "★ 参考", "ソースの取得状況"]) {
    if (!html.includes(heading)) reasons.push(`見出し「${heading}」がHTMLにありません`);
  }
  const forbidden = [
    [/<script\b/i, "<script>"],
    [/<link\b/i, "<link>"],
    [/<style\b/i, "<style>"],
    [/<img\b/i, "<img>"],
    [/@import/i, "@import"],
    [/url\(/i, "CSSのurl()"],
  ];
  for (const [re, label] of forbidden) {
    if (re.test(html)) reasons.push(`${label} が含まれています（メールクライアントで壊れます）`);
  }
  if (!html.includes('style="')) reasons.push("インラインstyleがありません");
  if (itemCount < 1) reasons.push(`候補が1件もありません（candidateCount=${itemCount}）`);
  return { ok: reasons.length === 0, reasons };
}

const steps = [];
function record(name, ok, detail = "") {
  steps.push({ name, ok, detail });
  console.log(`\n${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}\n`);
}

async function main() {
  console.log("=== 1. ユニットテスト ===");
  record("ユニットテスト", (await run("npm", ["test"])) === 0);

  console.log("=== 2. 実フィード収集（26本・ネットワークに出ます） ===");
  record("collect", (await run("node", ["src/collect-cli.js"])) === 0);

  const collected = readJsonOrNull(CANDIDATES_PATH);
  const candidateCount = collected?.stats?.candidateCount ?? 0;
  record("候補が1件以上", candidateCount > 0, `${candidateCount}件`);

  console.log("=== 3. judgments無しでのrender（契約層の実走確認） ===");
  const judgmentsPath = path.join(OUT_DIR, "judgments.json");
  const hadJudgments = fs.existsSync(judgmentsPath);
  if (hadJudgments) fs.renameSync(judgmentsPath, `${judgmentsPath}.bak`);
  const renderCode = await run("node", ["src/render-cli.js"]);
  if (hadJudgments) fs.renameSync(`${judgmentsPath}.bak`, judgmentsPath);
  record("judgments無しでもrenderが完走", renderCode === 0);

  console.log("=== 4. HTML検証 ===");
  const digest = readJsonOrNull(path.join(OUT_DIR, "digest.json"));
  let htmlOk = false;
  let htmlDetail = "digest.json がありません";
  if (digest?.htmlPath && fs.existsSync(digest.htmlPath)) {
    const { ok, reasons } = validateDigestHtml(fs.readFileSync(digest.htmlPath, "utf-8"), candidateCount);
    htmlOk = ok;
    htmlDetail = ok ? path.basename(digest.htmlPath) : reasons.join(" / ");
  }
  record("HTMLがメール本文として成立", htmlOk, htmlDetail);

  console.log("=== 5. 送信payloadの組み立て（--dry-run・実送信しません） ===");
  const sendCode = await run("node", ["src/send-cli.js", "--dry-run"], {
    // dry-run で payload の組み立てだけ確認するためのダミー値。実送信はしない
    MAIL_FROM: process.env.MAIL_FROM || "gadget-news-radar <digest@example.com>",
    MAIL_TO: process.env.MAIL_TO || "you@example.com",
  });
  record("send --dry-run", sendCode === 0);

  console.log("=== ゴール判定 ===");
  for (const s of steps) console.log(`  ${s.ok ? "✅" : "❌"} ${s.name}`);
  const allOk = steps.every((s) => s.ok);
  console.log(allOk ? "\n🎉 ゴール達成（exit 0）" : "\n未達（exit 1）");
  process.exit(allOk ? 0 : 1);
}

// テストから validateDigestHtml だけを import できるよう、直接実行時のみ走らせる
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
