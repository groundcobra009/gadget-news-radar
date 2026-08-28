// 送信した記事を「既出」として記録してよいかの判断。
//
// 判定ステップが全滅した回（judgments.json が無い・全件未判定）は記録しない。
// 記録してしまうと、その日のニュースが二度と推奨度つきで届かなくなるため。
// 24時間窓は固定境界で重ならないので、記録を見送っても翌日に同じ記事が二重で届くことはない。

/**
 * @param {{ itemCount?: number, unjudgedCount?: number }} digest
 * @returns {{ record: boolean, reason: string }}
 */
export function shouldRecordAsSent(digest) {
  const itemCount = digest?.itemCount;
  const unjudgedCount = digest?.unjudgedCount;

  if (!Number.isInteger(itemCount) || !Number.isInteger(unjudgedCount)) {
    return { record: false, reason: "件数が取れないため、安全側に倒して記録しません" };
  }
  if (itemCount === 0) {
    return { record: false, reason: "記事が0件のため記録するものがありません" };
  }
  if (unjudgedCount >= itemCount) {
    return {
      record: false,
      reason: "全件が未判定のため記録しません（翌日に同じ記事を判定つきで届けるため）",
    };
  }
  return { record: true, reason: "" };
}
