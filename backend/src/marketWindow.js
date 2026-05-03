/**
 * 증시 분석용 기사 시간창 계산 (KST 기준)
 * 마감: 평일 15:30 KST
 * 주말이면 직전 금요일 15:30으로 소급
 */
function getMarketWindow() {
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

  const close = new Date(kst);
  close.setDate(close.getDate() - 1);
  close.setHours(15, 30, 0, 0);

  const dow = close.getDay(); // 0=일, 6=토
  if (dow === 0) close.setDate(close.getDate() - 2);
  if (dow === 6) close.setDate(close.getDate() - 1);

  const fromUTC = new Date(close.getTime() - 9 * 60 * 60 * 1000);
  const toUTC = now;

  const fmt = (d) =>
    d.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return {
    from: fromUTC.toISOString(),
    to: toUTC.toISOString(),
    fromLabel: `${fmt(fromUTC)} (장 마감)`,
    toLabel: fmt(toUTC),
  };
}

module.exports = { getMarketWindow };
