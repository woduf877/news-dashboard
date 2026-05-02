const { runMultiple, isConfigured } = require('./aiAgent');
const {
  getMarketWindowArticles,
  getMarketDailySeries,
  getStockSummary,
  createAnalysis,
  saveAnalysisResult,
  saveAnalysisError,
} = require('./db');
const { getMarketWindow } = require('./keywords');

function fmtPct(ratio, digits = 3) {
  if (ratio == null || Number.isNaN(ratio)) return 'n/a';
  const pct = ratio * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(digits)}%`;
}

function fmtWon(value) {
  if (value == null || Number.isNaN(value)) return '0원';
  const sign = value >= 0 ? '+' : '-';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}조원`;
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(0)}억원`;
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(0)}만원`;
  return `${sign}${Math.round(abs)}원`;
}

function summarizeMarketSeries(market, series) {
  if (!series.length) return `${market}: 최근 수급 데이터 없음`;
  const recent = series.slice(-5);
  const latest = recent[recent.length - 1];
  const first = recent[0];
  const trend = latest.ratio > first.ratio ? '개선' : latest.ratio < first.ratio ? '악화' : '보합';
  const points = recent.map(r => `${r.trade_date}:${fmtPct(r.ratio)}`).join(', ');
  return `${market} 최근 5거래일 수급비율(${trend}) ${points}`;
}

function formatTopFlowLine(row) {
  return `${row.market} ${row.name}(${row.ticker}) 14일순매수=${fmtWon(row.cumNet)} 비율=${fmtPct(row.cumRatio)}`;
}

function buildKoreaStockTrendText() {
  const kospiSeries = getMarketDailySeries('KOSPI');
  const kosdaqSeries = getMarketDailySeries('KOSDAQ');
  const kospiSummary = getStockSummary('KOSPI');
  const kosdaqSummary = getStockSummary('KOSDAQ');
  const merged = [...kospiSummary, ...kosdaqSummary];
  if (!kospiSeries.length && !kosdaqSeries.length && !merged.length) return '';

  const topBuy = [...merged]
    .sort((a, b) => b.cumNet - a.cumNet)
    .slice(0, 5)
    .map(formatTopFlowLine);
  const topSell = [...merged]
    .sort((a, b) => a.cumNet - b.cumNet)
    .slice(0, 5)
    .map(formatTopFlowLine);

  return [
    summarizeMarketSeries('KOSPI', kospiSeries),
    summarizeMarketSeries('KOSDAQ', kosdaqSeries),
    `강한 순매수 상위 5: ${topBuy.length ? topBuy.join(' | ') : '데이터 없음'}`,
    `강한 순매도 상위 5: ${topSell.length ? topSell.join(' | ') : '데이터 없음'}`,
  ].join('\n');
}

async function runMarketAnalysis() {
  if (!isConfigured()) {
    console.warn('[marketAnalyzer] API 키 미설정 — backend/.env 파일을 확인하세요');
    return null;
  }

  const window   = getMarketWindow();
  const articles = getMarketWindowArticles(window.from, window.to);

  if (!articles.length) {
    console.warn('[marketAnalyzer] 분석할 기사 없음');
    return null;
  }

  const analysisId = createAnalysis(window.from, window.to, articles.length);
  console.log(`[marketAnalyzer] 듀얼 AI 3회 분석 시작 — 기사 ${articles.length}건`);

  try {
    const koreaStockTrendText = buildKoreaStockTrendText();
    const { runs, summary } = await runMultiple(articles, 3, { koreaStockTrendText });

    // 대표값: 성공한 run 중 첫 번째 (gemini_json / groq_json 하위 호환)
    const bestRun = runs.find(r => r.geminiResult && r.groqResult)
      || runs.find(r => r.geminiResult || r.groqResult)
      || runs[0];

    saveAnalysisResult(analysisId, {
      geminiResult: bestRun?.geminiResult || null,
      groqResult:   bestRun?.groqResult   || null,
      runs,
      summary,
    });

    console.log(`[marketAnalyzer] 완료 — 종합 sentiment: ${summary.sentiment}, 일치도: ${summary.consistency}, 종목: ${summary.stocks.length}개`);
    return analysisId;
  } catch (err) {
    saveAnalysisError(analysisId, err.message);
    console.error('[marketAnalyzer] 오류:', err.message);
    throw err;
  }
}

module.exports = { runMarketAnalysis };
