const { analyzeDual, isConfigured } = require('./aiAgent');
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
  console.log(`[marketAnalyzer] 듀얼 AI 분석 시작 — 기사 ${articles.length}건`);

  try {
    const { geminiResult, groqResult, errors } = await analyzeDual(articles);

    saveAnalysisResult(analysisId, { geminiResult, groqResult });

    const geminiStocks = geminiResult?.stocks?.length ?? 0;
    const groqStocks   = groqResult?.stocks?.length   ?? 0;
    console.log(`[marketAnalyzer] 완료 — Gemini ${geminiStocks}종목 / Groq ${groqStocks}종목`);
    if (Object.keys(errors).length) console.warn('[marketAnalyzer] 부분 오류:', errors);

    return analysisId;
  } catch (err) {
    saveAnalysisError(analysisId, err.message);
    console.error('[marketAnalyzer] 오류:', err.message);
    throw err;
  }
}

module.exports = { runMarketAnalysis };
