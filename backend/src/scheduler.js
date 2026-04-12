const cron = require('node-cron');
const { runCrawl } = require('./crawler');

// 오전 8시, 오후 1시 (한국 시간 KST = UTC+9)
// cron 표현식: 분 시 * * * (시간대 옵션으로 Asia/Seoul 지정)
const SCHEDULES = [
  { label: '오전 8시',   expr: '0 8 * * *' },
  { label: '오후 1시',   expr: '0 13 * * *' },
];

function startScheduler() {
  SCHEDULES.forEach(({ label, expr }) => {
    cron.schedule(
      expr,
      async () => {
        console.log(`[scheduler] ${label} 스케줄 실행`);
        await runCrawl();
      },
      { timezone: 'Asia/Seoul' }
    );
    console.log(`[scheduler] 등록 완료 — ${label} (${expr}, KST)`);
  });
}

module.exports = { startScheduler };
