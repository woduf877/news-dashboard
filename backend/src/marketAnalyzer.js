const { runMultiple, isConfigured } = require('./aiAgent');
const {
  getMarketWindowArticles,
  createAnalysis,
  saveAnalysisResult,
  saveAnalysisError,
} = require('./db');
const { getMarketWindow } = require('./keywords');

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
    const { runs, summary } = await runMultiple(articles, 3);

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
