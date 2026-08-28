#!/usr/bin/env node
// ワークフローが失敗したときに呼ぶ通知専用CLI。
// 隣の案件（miraichi）では毎朝の配信が1ヶ月間、無言で失敗し続けていた。
// 失敗したときこそメールが届くようにするのがこのファイルの唯一の役目。
import { sendFailureNotice } from "./mailer.js";

const reason = process.env.FAILURE_REASON || "GitHub Actions のいずれかのステップが失敗しました";
const runUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;

sendFailureNotice({ from: process.env.MAIL_FROM, to: process.env.MAIL_TO, reason, runUrl })
  .then(() => console.log("失敗通知メールを送信しました"))
  .catch((err) => {
    // 通知の失敗でワークフローをさらに壊さない。ログには必ず残す
    console.error(`失敗通知メールの送信にも失敗しました: ${err.message}`);
  });
