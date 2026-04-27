const cron = require('node-cron');
const { runCrawl } = require('./crawler');
const { runMarketAnalysis } = require('./marketAnalyzer');
const { collectStockData } = require('./stockCollector');

// 오전 8시, 오후 1시 (KST) — 뉴스 크롤 + AI 분석
const SCHEDULES = [
  { label: '오전 8시',  expr: '0 8 * * *' },
  { label: '오후 1시',  expr: '0 13 * * *' },
];

function startScheduler() {
  SCHEDULES.forEach(({ label, expr }) => {
    cron.schedule(
      expr,
      async () => {
        console.log(`[scheduler] ${label} 스케줄 실행`);
        await runCrawl();
        // 크롤 완료 후 AI 증시 분석 실행
        await runMarketAnalysis().catch(e =>
          console.error('[scheduler] AI 분석 오류:', e.message)
        );
      },
      { timezone: 'Asia/Seoul' }
    );
    console.log(`[scheduler] 등록 완료 — ${label} (${expr}, KST)`);
  });

  // 오후 6시 30분 (KST) — NXT 종료 후 주가 데이터 수집
  cron.schedule(
    '30 18 * * 1-5',   // 월~금 18:30 KST (주말 제외)
    async () => {
      console.log('[scheduler] NXT 종료 후 주가 데이터 수집 시작');
      await collectStockData().catch(e =>
        console.error('[scheduler] 주가 수집 오류:', e.message)
      );
    },
    { timezone: 'Asia/Seoul' }
  );
  console.log('[scheduler] 등록 완료 — 주가 수집 (18:30 KST, 월~금)');
}

module.exports = { startScheduler };
