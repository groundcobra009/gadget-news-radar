// メール送信。テストは絶対に実送信しない（クライアントを注入し、env も遮断する）。
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buildPayload, sendDigest, sendFailureNotice } from "../src/mailer.js";

beforeEach(() => {
  // 開発機で本物のメールが飛ばないよう、送信系envを必ず落とす
  delete process.env.RESEND_API_KEY;
  delete process.env.MAIL_FROM;
  delete process.env.MAIL_TO;
});

function fakeClient() {
  const sent = [];
  return {
    sent,
    emails: {
      send: async (payload) => {
        sent.push(payload);
        return { data: { id: "fake-id" }, error: null };
      },
    },
  };
}

test("buildPayload は from/to/subject/html を組み立てる", () => {
  const p = buildPayload({
    from: "ガジェットレーダー <digest@news.example.com>",
    to: "me@example.com",
    subject: "件名",
    html: "<p>本文</p>",
  });
  assert.equal(p.from, "ガジェットレーダー <digest@news.example.com>");
  assert.deepEqual(p.to, ["me@example.com"]);
  assert.equal(p.subject, "件名");
  assert.equal(p.html, "<p>本文</p>");
});

test("to はカンマ区切りでも配列にする", () => {
  const p = buildPayload({ from: "a@example.com", to: "x@example.com, y@example.com", subject: "s", html: "h" });
  assert.deepEqual(p.to, ["x@example.com", "y@example.com"]);
});

test("必須項目が欠けていたら送信前に落とす", () => {
  assert.throws(() => buildPayload({ from: "", to: "x@example.com", subject: "s", html: "h" }), /from/);
  assert.throws(() => buildPayload({ from: "a@example.com", to: "", subject: "s", html: "h" }), /to/);
  assert.throws(() => buildPayload({ from: "a@example.com", to: "x@example.com", subject: "", html: "h" }), /subject/);
  assert.throws(() => buildPayload({ from: "a@example.com", to: "x@example.com", subject: "s", html: "" }), /html/);
});

test("sendDigest は注入したクライアントにそのまま渡す", async () => {
  const client = fakeClient();
  const res = await sendDigest(
    { from: "a@example.com", to: "x@example.com", subject: "s", html: "<p>h</p>" },
    { client }
  );
  assert.equal(client.sent.length, 1);
  assert.equal(client.sent[0].subject, "s");
  assert.equal(res.id, "fake-id");
});

test("dryRun ではクライアントを呼ばない", async () => {
  const client = fakeClient();
  const res = await sendDigest(
    { from: "a@example.com", to: "x@example.com", subject: "s", html: "<p>h</p>" },
    { client, dryRun: true }
  );
  assert.equal(client.sent.length, 0);
  assert.equal(res.dryRun, true);
  assert.equal(res.payload.subject, "s");
});

test("Resend がエラーを返したら例外にする（黙って成功扱いにしない）", async () => {
  const client = {
    emails: { send: async () => ({ data: null, error: { message: "domain is not verified" } }) },
  };
  await assert.rejects(
    () => sendDigest({ from: "a@example.com", to: "x@example.com", subject: "s", html: "h" }, { client }),
    /domain is not verified/
  );
});

test("失敗通知メールは件名に【失敗】が入り、原因が本文に入る", async () => {
  const client = fakeClient();
  await sendFailureNotice(
    { from: "a@example.com", to: "x@example.com", reason: "collect が異常終了", runUrl: "https://github.com/o/r/actions/runs/1" },
    { client }
  );
  assert.ok(client.sent[0].subject.includes("【失敗】"));
  assert.ok(client.sent[0].html.includes("collect が異常終了"));
  assert.ok(client.sent[0].html.includes("https://github.com/o/r/actions/runs/1"));
});
