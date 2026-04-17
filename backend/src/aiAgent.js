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

// ─── 공통 분석 프롬프트 ─────────────────────────────────

const ANALYST_SYSTEM = `당신은 한국·미국 주식시장 전문 분석가입니다.
주어진 뉴스 기사들을 읽고 영향받을 가능성이 있는 한국·미국 상장 종목들을 분석하세요.
뉴스 태그([korea_market], [us_market] 등)를 참고하여 각 시장의 흐름을 파악하고,
두 시장 간의 상호 영향도 함께 분석하세요.

반드시 아래 JSON 형식만 반환하세요:
{
  "summary": "전체 뉴스 핵심 테마 요약 (2~3문장, 한국어)",
  "sentiment": "bullish | bearish | neutral",
  "sentimentReason": "시장 방향성 근거 — 한국·미국 시장 각각 언급 (1~2문장)",
  "stocks": [
    {
      "ticker": "종목코드 예: 005930 또는 NVDA",
      "name": "종목명 예: 삼성전자 또는 NVIDIA",
      "market": "KOSPI | KOSDAQ | NYSE | NASDAQ",
      "impact": "positive | negative | neutral",
      "score": 0.0~1.0,
      "reason": "주가 영향 근거 (1~2문장, 한국어)",
      "relatedNews": ["관련 뉴스 제목"]
    }
  ],
  "sectors": [
    { "name": "섹터명", "impact": "positive | negative | neutral", "reason": "근거" }
  ],
  "themes": ["핵심 테마1", "핵심 테마2"],
  "crossMarketInsight": "미국 증시가 한국 증시에 미치는 영향 또는 공통 테마 (1~2문장, 한국어)"
}

주요 종목 참고:
KOSPI: 삼성전자(005930), SK하이닉스(000660), LG에너지솔루션(373220), 현대차(005380),
  기아(000270), POSCO홀딩스(005490), LG화학(051910), 삼성바이오로직스(207940),
  삼성SDI(006400), KB금융(105560), 신한지주(055550), 하나금융지주(086790),
  한국전력(015760), 셀트리온(068270), NAVER(035420), 카카오(035720),
  HD현대중공업(329180), 한화에어로스페이스(012450), LG전자(066570)
KOSDAQ: 에코프로비엠(247540), 에코프로(086520), 알테오젠(196170),
  HLB(028300), 리가켐바이오(141080), 레인보우로보틱스(277810)
NYSE/NASDAQ: Apple(AAPL), Microsoft(MSFT), NVIDIA(NVDA), Amazon(AMZN),
  Alphabet(GOOGL), Meta(META), Tesla(TSLA), Berkshire(BRK.B),
  JPMorgan(JPM), Visa(V), ExxonMobil(XOM), Johnson&Johnson(JNJ),
  Netflix(NFLX), AMD(AMD), Intel(INTC), Qualcomm(QCOM)

중요: 뉴스와 직접 연관된 종목만 포함. stocks 최대 15개 (한국·미국 합산).`;

// ─── Groq 리뷰어 프롬프트 ──────────────────────────────

const REVIEWER_SYSTEM = `당신은 한국·미국 주식시장 수석 리뷰어입니다.
주니어 분석가(Gemini)가 뉴스를 분석한 결과를 검토하고, 독립적인 의견을 제시하세요.
한국 증시와 미국 증시 모두를 아우르는 시각으로 판단하세요.

반드시 아래 JSON 형식만 반환하세요:
{
  "agreement": "agree | partial | disagree",
  "agreementScore": 0.0~1.0,
  "reviewSummary": "Gemini 분석에 대한 전체 평가 (2~3문장, 한국어)",
  "summary": "리뷰어 자체 뉴스 분석 요약 (2~3문장, 한국어)",
  "sentiment": "bullish | bearish | neutral",
  "sentimentReason": "리뷰어 관점의 시장 방향성 근거 — 한국·미국 각각 언급 (1~2문장)",
  "stocksAgreed": ["동의하는 ticker 목록, 예: 005930 또는 NVDA"],
  "stocksDisagreed": [
    { "ticker": "ticker", "reason": "동의하지 않는 구체적 이유" }
  ],
  "stocks": [
    {
      "ticker": "종목코드 예: 005930 또는 NVDA",
      "name": "종목명",
      "market": "KOSPI | KOSDAQ | NYSE | NASDAQ",
      "impact": "positive | negative | neutral",
      "score": 0.0~1.0,
      "reason": "리뷰어 자체 영향 근거 (1~2문장, 한국어)",
      "relatedNews": ["관련 뉴스 제목"]
    }
  ],
  "sectors": [
    { "name": "섹터명", "impact": "positive | negative | neutral", "reason": "근거" }
  ],
  "themes": ["핵심 테마1", "핵심 테마2"],
  "crossMarketInsight": "미국 증시가 한국 증시에 미치는 영향 또는 공통 테마 (1~2문장, 한국어)",
  "additionalInsights": "Gemini가 놓친 추가 인사이트 (있으면, 없으면 null)"
}

중요: 반드시 독립적으로 판단하세요. Gemini와 다른 의견이 있으면 명확히 표현하세요.
stocks 최대 15개 (한국·미국 합산).`;

// ─── 유틸 ───────────────────────────────────────────────

function buildNewsText(articles) {
  return articles
    .slice(0, 40)
    .map((a, i) =>
      `[${i + 1}][${a.category}] ${a.title}\n${(a.description || '').slice(0, 200)}`
    )
    .join('\n\n');
}

function safeJson(text) {
  // JSON 블록이 마크다운 코드블럭 안에 있을 경우 추출
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(match ? match[1].trim() : text.trim());
}

// ─── Gemini 1차 분석 ────────────────────────────────────

async function runGeminiAnalysis(articles) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY 미설정');

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const prompt = `${ANALYST_SYSTEM}\n\n--- 분석 대상 뉴스 ---\n${buildNewsText(articles)}`;

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

async function runGroqReview(articles, geminiResult) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY 미설정');

  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const userMessage = `
=== 원본 뉴스 ===
${buildNewsText(articles)}

=== Gemini(분석가) 결과 ===
${JSON.stringify(geminiResult, null, 2)}

위 분석 결과를 검토하고 당신(리뷰어)의 독립적인 의견을 JSON으로 반환하세요.`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: REVIEWER_SYSTEM },
      { role: 'user',   content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  return safeJson(completion.choices[0].message.content);
}

// ─── 메인: 듀얼 에이전트 실행 (1회) ────────────────────

async function analyzeDual(articles) {
  const errors = {};

  // 1단계: Gemini 분석
  let geminiResult = null;
  try {
    console.log('[aiAgent] Gemini 분석 시작…');
    geminiResult = await runGeminiAnalysis(articles);
    console.log('[aiAgent] Gemini 완료');
  } catch (e) {
    errors.gemini = e.message;
    console.error('[aiAgent] Gemini 오류:', e.message);
  }

  // 2단계: Groq 리뷰 (Gemini 결과 유무 관계없이 독립 실행)
  let groqResult = null;
  try {
    console.log('[aiAgent] Groq 리뷰 시작…');
    groqResult = await runGroqReview(articles, geminiResult || {});
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

async function runMultiple(articles, count = 3) {
  const runs = [];
  for (let i = 0; i < count; i++) {
    console.log(`[aiAgent] 멀티 분석 ${i + 1}/${count}회`);
    try {
      const result = await analyzeDual(articles);
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
