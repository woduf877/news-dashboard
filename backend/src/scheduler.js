const cron = require('node-cron');
const { runCrawl } = require('./crawler');
const { runMarketAnalysis } = require('./marketAnalyzer');

// 오전 8시, 오후 1시 (KST)
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
}

module.exports = { startScheduler };
