/**
 * 듀얼 AI 에이전트 모듈
 *
 * 역할 분담:
 *  - Gemini 2.0 Flash  → 1차 분석가 (뉴스를 읽고 영향 종목 분석)
 *  - Groq Llama 3.3 70B → 감독·리뷰어 (Gemini 결과를 검토하고 자체 의견 추가)
 *
 * 두 모델 모두 무료 티어 사용:
 *  - Gemini: aistudio.google.com/apikey   (1일 1500회 무료)
 *  - Groq:   console.groq.com/keys        (1일 14400회 무료)
 */

const {
  buildAnalystPrompt,
  buildReviewerMessages,
} = require('./aiPromptHarness');

// ─── 유틸 ───────────────────────────────────────────────

function safeJson(text) {
  // JSON 블록이 마크다운 코드블럭 안에 있을 경우 추출
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(match ? match[1].trim() : text.trim());
}

// ─── Gemini 1차 분석 ────────────────────────────────────

async function runGeminiAnalysis(articles, promptContext = {}) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY 미설정');

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const prompt = buildAnalystPrompt(articles, promptContext);

  // 503 일시적 과부하 대비 최대 3회 재시도
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return safeJson(result.response.text());
    } catch (e) {
      const is503 = e.message?.includes('503') || e.status === 503;
      if (is503 && attempt < MAX_RETRIES) {
        const delay = attempt * 5000;
        console.log(`[aiAgent] Gemini 503 — ${attempt}/${MAX_RETRIES}회 시도, ${delay/1000}초 후 재시도`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw e;
      }
    }
  }
}

// ─── Groq 리뷰 ──────────────────────────────────────────

async function runGroqReview(articles, geminiResult, promptContext = {}) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY 미설정');

  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const { system, user } = buildReviewerMessages(articles, geminiResult, promptContext);

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  return safeJson(completion.choices[0].message.content);
}

// ─── 메인: 듀얼 에이전트 실행 (1회) ────────────────────

async function analyzeDual(articles, promptContext = {}) {
  const errors = {};

  // 1단계: Gemini 분석
  let geminiResult = null;
  try {
    console.log('[aiAgent] Gemini 분석 시작…');
    geminiResult = await runGeminiAnalysis(articles, promptContext);
    console.log('[aiAgent] Gemini 완료');
  } catch (e) {
    errors.gemini = e.message;
    console.error('[aiAgent] Gemini 오류:', e.message);
  }

  // 2단계: Groq 리뷰 (Gemini 결과 유무 관계없이 독립 실행)
  let groqResult = null;
  try {
    console.log('[aiAgent] Groq 리뷰 시작…');
    groqResult = await runGroqReview(articles, geminiResult || {}, promptContext);
    console.log('[aiAgent] Groq 완료');
  } catch (e) {
    errors.groq = e.message;
    console.error('[aiAgent] Groq 오류:', e.message);
  }

  if (!geminiResult && !groqResult) {
    throw new Error(
      `두 에이전트 모두 실패 — Gemini: ${errors.gemini}, Groq: ${errors.groq}`
    );
  }

  return { geminiResult, groqResult, errors };
}

// ─── 3회 반복 실행 ──────────────────────────────────────

async function runMultiple(articles, count = 3, promptContext = {}) {
  const runs = [];
  for (let i = 0; i < count; i++) {
    console.log(`[aiAgent] 멀티 분석 ${i + 1}/${count}회`);
    try {
      const result = await analyzeDual(articles, promptContext);
      runs.push(result);
    } catch (e) {
      console.error(`[aiAgent] ${i + 1}회 전체 실패:`, e.message);
      runs.push({ geminiResult: null, groqResult: null, errors: { fatal: e.message } });
    }
    if (i < count - 1) await new Promise(r => setTimeout(r, 3000));
  }
  const summary = summarizeRuns(runs);
  return { runs, summary };
}

// ─── 결과 종합 ──────────────────────────────────────────

function summarizeRuns(runs) {
  // 전체 sentiment 투표 (Gemini + Groq 합산)
  const votes = {};
  for (const run of runs) {
    for (const s of [run.geminiResult?.sentiment, run.groqResult?.sentiment]) {
      if (s) votes[s] = (votes[s] || 0) + 1;
    }
  }
  const sentiment = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

  // 일치도: Gemini 3회 sentiment 기준
  const geminiSentiments = runs.map(r => r.geminiResult?.sentiment).filter(Boolean);
  const uniqueGemini = new Set(geminiSentiments);
  const consistency =
    uniqueGemini.size <= 1 ? 'high' :
    uniqueGemini.size === 2 ? 'medium' : 'low';

  // 종목: 회차별로 Gemini+Groq 합쳐서 1회 카운트, 2회 이상 등장한 것만
  const stockMap = {};
  for (const run of runs) {
    const seen = new Set();
    for (const stock of [...(run.geminiResult?.stocks || []), ...(run.groqResult?.stocks || [])]) {
      if (seen.has(stock.ticker)) continue;
      seen.add(stock.ticker);
      if (!stockMap[stock.ticker]) {
        stockMap[stock.ticker] = { ...stock, scores: [], impacts: [], count: 0 };
      }
      stockMap[stock.ticker].scores.push(stock.score || 0);
      stockMap[stock.ticker].impacts.push(stock.impact);
      stockMap[stock.ticker].count++;
    }
  }
  const stocks = Object.values(stockMap)
    .filter(s => s.count >= 2)
    .map(({ scores, impacts, count, ...s }) => {
      const impactVote = impacts.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
      return {
        ...s,
        score: scores.reduce((a, b) => a + b, 0) / scores.length,
        impact: Object.entries(impactVote).sort((a, b) => b[1] - a[1])[0][0],
        appearCount: count,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // 섹터: 2회 이상 등장
  const sectorMap = {};
  for (const run of runs) {
    const seen = new Set();
    for (const sec of [...(run.geminiResult?.sectors || []), ...(run.groqResult?.sectors || [])]) {
      if (seen.has(sec.name)) continue;
      seen.add(sec.name);
      if (!sectorMap[sec.name]) sectorMap[sec.name] = { ...sec, count: 0 };
      sectorMap[sec.name].count++;
    }
  }
  const sectors = Object.values(sectorMap).filter(s => s.count >= 2);

  // 테마: 2회 이상 등장
  const themeMap = {};
  for (const run of runs) {
    const seen = new Set();
    for (const theme of [...(run.geminiResult?.themes || []), ...(run.groqResult?.themes || [])]) {
      if (seen.has(theme)) continue;
      seen.add(theme);
      themeMap[theme] = (themeMap[theme] || 0) + 1;
    }
  }
  const themes = Object.entries(themeMap)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  return { sentiment, consistency, runCount: runs.length, stocks, sectors, themes };
}

function isConfigured() {
  return !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}

module.exports = { analyzeDual, runMultiple, summarizeRuns, isConfigured };
