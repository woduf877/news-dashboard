const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const {
  getArticles,
  getCategoryCounts,
  getCrawlLogs,
  getLastCrawlTime,
  getWordCloud,
  getHeatmapData,
  getTopKeywords,
  getTrendData,
  getAllArticlesForKeywords,
  keywordStatsEmpty,
  upsertKeywords,
  getMarketWindowArticles,
  getMarketHourlyCount,
  getLatestAnalysis,
  getAnalysisStatus,
  getStockSummary,
  getStockTimeSeries,
  getMarketDailySeries,
} = require('./db');
const {
  collectStockData,
  getCollectionDate,
  getStockCollectionStatus,
  kisDiagnose,
} = require('./stockCollector');
const { extractFromArticles, computeMarketKeywords, getMarketWindow } = require('./keywords');
const { runCrawl, NEWS_SOURCES, KOREA_MARKET_SOURCES, US_MARKET_SOURCES } = require('./crawler');
const { runMarketAnalysis } = require('./marketAnalyzer');
const { isConfigured } = require('./aiAgent');
const { startScheduler } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 프로덕션: 빌드된 React 정적 파일 서빙
const STATIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(STATIC_DIR));

// ─── API ──────────────────────────────────────────────

// 기사 목록
app.get('/api/news', (req, res) => {
  const { category, limit = 60, offset = 0, date } = req.query;
  const articles = getArticles({
    category,
    limit: Math.min(Number(limit), 200),
    offset: Number(offset),
    date,
  });
  res.json({ ok: true, data: articles });
});

// 카테고리별 기사 수
app.get('/api/categories', (req, res) => {
  const counts = getCategoryCounts();
  // 전체 합계 추가
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  res.json({ ok: true, data: [{ category: 'all', count: total }, ...counts] });
});

// 크롤 로그
app.get('/api/crawl-logs', (req, res) => {
  const logs = getCrawlLogs(20);
  res.json({ ok: true, data: logs });
});

// 마지막 크롤 시각 + 다음 크롤 예정
app.get('/api/status', (req, res) => {
  const last = getLastCrawlTime();
  const now = new Date();
  const nextTimes = getNextCrawlTimes(now);
  res.json({
    ok: true,
    data: {
      lastCrawlAt: last?.finished_at || null,
      nextCrawlAt: nextTimes,
      sources: NEWS_SOURCES.length + KOREA_MARKET_SOURCES.length + US_MARKET_SOURCES.length,
    },
  });
});

// 수동 크롤 트리거
app.post('/api/crawl', async (req, res) => {
  res.json({ ok: true, message: '크롤 시작됨' });
  runCrawl().catch(console.error);
});

// ─── 키워드 분석 API ──────────────────────────────────

// 워드 클라우드 데이터
app.get('/api/analytics/wordcloud', (req, res) => {
  const { category = 'all', days = 30, limit = 80 } = req.query;
  const data = getWordCloud({ category, days: Number(days), limit: Number(limit) });
  res.json({ ok: true, data });
});

// 히트맵 그리드 데이터 (keyword × date)
app.get('/api/analytics/heatmap', (req, res) => {
  const { category = 'all', days = 14, topN = 20 } = req.query;
  const data = getHeatmapData({ category, days: Number(days), topN: Number(topN) });
  res.json({ ok: true, data });
});

// TOP 10 키워드 (일별 / 주별 / 월별)
app.get('/api/analytics/top', (req, res) => {
  const { category = 'all', period = 'daily' } = req.query;
  const data = getTopKeywords({ category, period });
  res.json({ ok: true, data });
});

// 트렌드 라인 (상위 키워드 일별 추이)
app.get('/api/analytics/trends', (req, res) => {
  const { category = 'all', days = 30 } = req.query;
  const data = getTrendData({ category, days: Number(days) });
  res.json({ ok: true, data });
});

// ─── 한국 증시 AI 분석 API ────────────────────────────

// 최신 AI 분석 결과 조회
app.get('/api/market/analysis', (req, res) => {
  const analysis = getLatestAnalysis();
  const status   = getAnalysisStatus();
  const window   = getMarketWindow();
  const articles = getMarketWindowArticles(window.from, window.to);

  res.json({
    ok: true,
    data: {
      analysis,          // 최신 성공 분석 (없으면 null)
      status,            // 가장 최근 작업 상태 (pending/success/error)
      window,
      articleCount: articles.length,
      aiConfigured: isConfigured(),
    },
  });
});

// AI 분석 수동 트리거 (비동기)
app.post('/api/market/analyze', (req, res) => {
  if (!isConfigured()) {
    return res.status(400).json({
      ok: false,
      error: 'GEMINI_API_KEY 또는 GROQ_API_KEY가 backend/.env에 설정되지 않았습니다',
    });
  }
  res.json({ ok: true, message: 'AI 분석 시작됨' });
  runMarketAnalysis().catch(e => console.error('[api] 분석 오류:', e.message));
});

// 시간별 기사 수 히스토그램
app.get('/api/market/hourly', (req, res) => {
  const window = getMarketWindow();
  const rows   = getMarketHourlyCount(window.from, window.to);
  res.json({ ok: true, data: rows, window });
});

// ─── 다음 크롤 예정 시각 계산 ─────────────────────────

function getNextCrawlTimes(now) {
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const results = [];

  [8, 13].forEach((hour) => {
    const next = new Date(kst);
    next.setHours(hour, 0, 0, 0);
    if (next <= kst) next.setDate(next.getDate() + 1);
    results.push(next.toISOString());
  });

  return results.sort();
}

// ─── 주가 데이터 API ─────────────────────────────────

// 시장 전체 일별 수급 비율 (시장 차트용)
app.get('/api/stocks/market-series', (req, res) => {
  const market = (req.query.market || 'KOSPI').toUpperCase();
  try {
    res.json({ ok: true, data: getMarketDailySeries(market) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 시총 TOP100 누적 수급 비율 목록 (종목 리스트용)
app.get('/api/stocks/summary', (req, res) => {
  const market = (req.query.market || 'KOSPI').toUpperCase();
  try {
    res.json({ ok: true, data: getStockSummary(market) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 개별 종목 14일 시계열 (상세 차트용)
app.get('/api/stocks/series/:ticker', (req, res) => {
  try {
    res.json({ ok: true, data: getStockTimeSeries(req.params.ticker) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 수동 수집 트리거 (비동기 — 즉시 응답)
app.post('/api/stocks/collect', (req, res) => {
  const status = getStockCollectionStatus();
  if (status.running) {
    return res.json({ ok: true, message: '이미 주가 수집 중입니다', status });
  }

  res.json({ ok: true, message: '주가 수집 시작됨 (백그라운드)' });
  collectStockData().catch(e => console.error('[api] 주가 수집 오류:', e.message));
});

// 주가 수집 상태
app.get('/api/stocks/collect-status', (req, res) => {
  res.json({ ok: true, data: getStockCollectionStatus() });
});

// KIS API 진단 (토큰·필드명 확인용)
app.get('/api/stocks/diagnose', async (req, res) => {
  try {
    const result = await kisDiagnose();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// React 라우팅 폴백 (SPA) — 반드시 모든 API 라우트 이후에 위치
app.get('*', (req, res) => {
  const index = path.join(STATIC_DIR, 'index.html');
  res.sendFile(index, (err) => {
    if (err) res.status(404).json({ error: 'Not found' });
  });
});

// ─── 서버 시작 ───────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n뉴스 대시보드 서버 실행 중 → http://localhost:${PORT}`);
  startScheduler();

  // 서버 시작 시 기사가 없으면 즉시 첫 크롤 실행
  const { getArticles: _ga } = require('./db');
  const sample = _ga({ limit: 1 });
  if (sample.length === 0) {
    console.log('[server] 데이터 없음 — 초기 크롤 실행');
    runCrawl().catch(console.error);
  } else if (keywordStatsEmpty()) {
    // 기사는 있지만 키워드 통계가 없으면 기존 기사로 재계산
    console.log('[server] 키워드 통계 없음 — 기존 기사로 재계산 중…');
    const articles = getAllArticlesForKeywords();
    const extracted = extractFromArticles(articles);
    upsertKeywords(extracted);
    console.log(`[server] 키워드 재계산 완료 (기사 ${articles.length}건)`);
  }
});
