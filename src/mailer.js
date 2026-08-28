// Resend でのメール送信。
// テストから実送信が飛ばないよう、クライアントは必ず注入できる形にしてある。
// 送信先は「自分のGmail 1通」に限る運用（DECISIONS.md 参照）。宛先を第三者に広げるときは
// 承認キュー（ai-company CLAUDE.md §2）の対象に戻すこと。
import { escapeHtml } from "./render.js";

function toRecipients(to) {
  if (Array.isArray(to)) return to.map((t) => String(t).trim()).filter(Boolean);
  return String(to ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * 送信payloadを組み立てる。必須項目が欠けていたら送信前に落とす
 * （Resendに投げてから気づくと、失敗が握りつぶされやすいため）。
 */
export function buildPayload({ from, to, subject, html }) {
  if (!from) throw new Error("from が空です（MAIL_FROM を確認してください）");
  const recipients = toRecipients(to);
  if (recipients.length === 0) throw new Error("to が空です（MAIL_TO を確認してください）");
  if (!subject) throw new Error("subject が空です");
  if (!html) throw new Error("html が空です");
  return { from, to: recipients, subject, html };
}

// 実クライアントは呼ばれたときだけ作る（テスト経路でSDKに触れないようにする）
async function defaultClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY が設定されていません");
  const { Resend } = await import("resend");
  return new Resend(apiKey);
}

async function send(payload, { client, dryRun = false } = {}) {
  if (dryRun) return { dryRun: true, payload };
  const resend = client ?? (await defaultClient());
  const { data, error } = await resend.emails.send(payload);
  if (error) {
    throw new Error(`Resend送信に失敗: ${error.message ?? JSON.stringify(error)}`);
  }
  return { id: data?.id ?? null, dryRun: false };
}

/** ダイジェスト本体を送る */
export async function sendDigest(input, options = {}) {
  return send(buildPayload(input), options);
}

/**
 * 生成に失敗したことを知らせる。
 * これが本システムで一番重要な安全弁 —— 隣の案件では1ヶ月間、毎朝の配信が無言で
 * 失敗し続けていた。失敗したときこそメールが届くようにする。
 */
export async function sendFailureNotice({ from, to, reason, runUrl }, options = {}) {
  const body = [
    `<div style="font-family:sans-serif;font-size:13px;line-height:1.8;color:#1c1c1c;">`,
    `<p style="color:#c0392b;font-weight:700;">ガジェットダイジェストの生成に失敗しました。</p>`,
    `<p>原因: ${escapeHtml(reason ?? "不明")}</p>`,
    runUrl ? `<p>実行ログ: <a href="${escapeHtml(runUrl)}">${escapeHtml(runUrl)}</a></p>` : "",
    "</div>",
  ].join("");
  return send(
    buildPayload({ from, to, subject: "【失敗】ガジェットニュース ダイジェスト", html: body }),
    options
  );
}
