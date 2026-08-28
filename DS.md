# DS.md — gadget-news-radar 要件の正本

エリア（終わりのない継続業務）なので GOAL.md は作らない。要件はこのファイルが正本。

## 何のためにあるか

けいたろうが手で26サイトを巡回する時間をゼロにし、拾い漏れをなくす。
毎朝5時に届くメール1通で「今日の資料に足せるネタ」と「買うか判断すべき機材」がわかる状態にする。

## 満たすべきこと

1. `config/feeds.yaml` の有効な全ソースを毎朝収集し、**直近24時間分**（JST 5:00 固定境界）に絞る
2. 記事に推奨度 ★1〜★3 を付け、`config/profile.md` の基準に沿った理由を添える
3. HTML全文をメール本文に埋め込んで、本人のGmailに1通送る
4. **同じ記事を2回送らない**（`data/processed-items.json` で突合）
5. **失敗を無言にしない** — 取得できなかったソースは理由つきでメールに出し、判定できなかった
   記事は「未判定」として出し、ワークフローが落ちたら失敗通知メールを送る
6. コードの品質ゲートは `npm run goal` の成功で判定する

## ゴールコマンド

```bash
npm run goal
```

`npm test` 全緑 → 実フィード収集で候補1件以上 → judgments無しでも render 完走 →
生成HTMLに必須見出しが揃い外部リソース参照が0 → `send --dry-run` が payload を組み立てる。
すべて通れば exit 0。

## 目視で確認すること（コマンド化できない部分）

1. `gh workflow run daily-digest.yml` を手動実行し、Actions が success
2. 届いたメールが**スマホで**崩れずに読める
3. ★★★ の記事が実際に読む価値のあるものになっている
   → ずれていたら `config/profile.md` を直す（コードは触らない）

## やらないこと

- 記事本文のスクレイピング（RSSのsummaryまでで判定する。robots.txt / ToS 尊重）
- Gmail以外への配信（Slack / LINE 等）
- 過去記事の検索UI・GitHub Pages 公開（`out/report-*.html` はコミットして残すだけ）
- 第三者への配信（する場合は承認キュー対象に戻す。DECISIONS.md 参照）

## 調整ポイント（運用しながら触る場所）

| 変えたいこと | 触るファイル |
|---|---|
| ★の付き方・関心軸 | `config/profile.md` |
| 収集元の追加・除外 | `config/feeds.yaml`（`enabled`） |
| 拾いやすさ・減点 | `config/keywords.yaml` |
| 配信時刻 | `.github/workflows/daily-digest.yml` の cron 1行 |
| LLMに渡す上限件数 | `src/collect.js` の `DEFAULT_MAX_CANDIDATES` |
