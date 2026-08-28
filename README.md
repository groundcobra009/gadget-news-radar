# ガジェットニュース毎朝ダイジェスト（gadget-news-radar）

26本のRSSを毎朝5時に24時間分収集し、Claude が推奨度（★1〜★3）を付けたHTMLダイジェストを
Resend でGmailに配信する。GitHub Actions の cron で自動実行。

## パイプライン

```
① npm run collect   26フィード取得 → 24h窓で絞る → 既出除外 → スコア順 → out/candidates.json
                    LLMに渡す用の絞り込み版 out/judge-input.json も書く
                          ↓
② Claude（GitHub Actions のみ）  judge-input.json + config/profile.md を読み
                                 out/judgments.json を書く ← 唯一の非決定論パート
                          ↓
③ npm run render    候補 × 判定 → out/report-YYYY-MM-DD.html
                    judgments.json が無くても壊れていても落ちない（全件「未判定」で描画）
                          ↓
④ npm run send      Resend で送信 → 送信できた記事を data/processed-items.json に記録
```

**この分離が設計の核**。エージェントが壊れたJSONを書いても、何も書かなくても、メールは必ず届き、
その中に「未判定 N件」と赤字で出る。無言の失敗が原理的に起きない。
（判定なしで1ヶ月間、毎朝の配信が無言で失敗していた別案件の反省から）

## セットアップ

```bash
npm ci
npm test          # 78件・ネットワークに出ない
npm run goal      # 完成判定（実フィードに出る）
```

送信を試すときは `.env.example` を `.env` にコピーして値を入れる。

### GitHub Secrets（本人が登録する）

| キー | 用途 |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | 判定ステップ。`claude setup-token` で発行（Maxサブスクを使うので追加課金なし） |
| `RESEND_API_KEY` | メール送信 |
| `MAIL_FROM` | `ガジェットレーダー <digest@news.keitro-aigc.com>`（ドメイン検証前は `onboarding@resend.dev` でも可） |
| `MAIL_TO` | 配信先。**本人のGmail 1件のみ**（増やすときは DECISIONS.md の線引きを読む） |

## 設定

| ファイル | 中身 |
|---|---|
| `config/feeds.yaml` | 収集元26本。`enabled: false` で除外できる（コード修正不要） |
| `config/keywords.yaml` | スコア加点・減点のキーワード。**捨てるためではなく並べるため** |
| `config/profile.md` | 推奨度の判定基準。★の付き方を変えたいときはここを直す |

## 運用メモ

- **24時間窓は JST 5:00 固定境界**。GitHub の cron は数分〜数十分遅れるので、実行時刻から
  24時間を引くと窓がずれて穴や重複が出る。固定境界にすればどれだけ遅れても穴が出ない
- **落ちたフィードは黙って消さない**。メール末尾に理由つきで出る。連続して落ちるようなら
  `config/feeds.yaml` で `enabled: false` にする
- **Digital Trends は HTTP 202 を返す**（CSV作成時点から0件）。様子を見て無効化する
- 記事本文のスクレイピングはしない（RSSのsummaryまで）

## テスト

`node --test`。全テストが fixture ベースでネットワークに出ない（fetcher とメールクライアントを
注入する）。`test/fixtures/` に RSS 2.0 / RDF(Impress系) / Atom / Shift_JIS / 空 / 壊れXML を置いてある。
