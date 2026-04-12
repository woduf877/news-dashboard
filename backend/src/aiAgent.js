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

const ANALYST_SYSTEM = `당신은 한국 주식시장(KOSPI·KOSDAQ) 전문 분석가입니다.
주어진 뉴스 기사들을 읽고 영향받을 가능성이 있는 한국 상장 종목들을 분석하세요.

반드시 아래 JSON 형식만 반환하세요:
{
  "summary": "전체 뉴스 핵심 테마 요약 (2~3문장, 한국어)",
  "sentiment": "bullish | bearish | neutral",
  "sentimentReason": "시장 방향성 근거 (1문장)",
  "stocks": [
    {
      "ticker": "종목코드 예: 005930",
      "name": "종목명 예: 삼성전자",
      "market": "KOSPI 또는 KOSDAQ",
      "impact": "positive | negative | neutral",
      "score": 0.0~1.0,
      "reason": "주가 영향 근거 (1~2문장, 한국어)",
      "relatedNews": ["관련 뉴스 제목"]
    }
  ],
  "sectors": [
    { "name": "섹터명", "impact": "positive | negative | neutral", "reason": "근거" }
  ],
  "themes": ["핵심 테마1", "핵심 테마2"]
}

주요 종목 참고:
KOSPI: 삼성전자(005930), SK하이닉스(000660), LG에너지솔루션(373220), 현대차(005380),
  기아(000270), POSCO홀딩스(005490), LG화학(051910), 삼성바이오로직스(207940),
  삼성SDI(006400), KB금융(105560), 신한지주(055550), 하나금융지주(086790),
  한국전력(015760), 셀트리온(068270), NAVER(035420), 카카오(035720),
  HD현대중공업(329180), 한화에어로스페이스(012450), LG전자(066570)
KOSDAQ: 에코프로비엠(247540), 에코프로(086520), 알테오젠(196170),
  HLB(028300), 리가켐바이오(141080), 레인보우로보틱스(277810)

중요: 뉴스와 직접 연관된 종목만 포함. stocks 최대 10개.`;

// ─── Groq 리뷰어 프롬프트 ──────────────────────────────

const REVIEWER_SYSTEM = `당신은 한국 주식시장 수석 리뷰어입니다.
주니어 분석가(Gemini)가 뉴스를 분석한 결과를 검토하고, 독립적인 의견을 제시하세요.

반드시 아래 JSON 형식만 반환하세요:
{
  "agreement": "agree | partial | disagree",
  "agreementScore": 0.0~1.0,
  "reviewSummary": "Gemini 분석에 대한 전체 평가 (2~3문장, 한국어)",
  "summary": "리뷰어 자체 뉴스 분석 요약 (2~3문장, 한국어)",
  "sentiment": "bullish | bearish | neutral",
  "sentimentReason": "리뷰어 관점의 시장 방향성 근거 (1문장)",
  "stocksAgreed": ["동의하는 ticker 목록, 예: 005930"],
  "stocksDisagreed": [
    { "ticker": "ticker", "reason": "동의하지 않는 구체적 이유" }
  ],
  "stocks": [
    {
      "ticker": "종목코드",
      "name": "종목명",
      "market": "KOSPI 또는 KOSDAQ",
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
  "additionalInsights": "Gemini가 놓친 추가 인사이트 (있으면, 없으면 null)"
}

중요: 반드시 독립적으로 판단하세요. Gemini와 다른 의견이 있으면 명확히 표현하세요.
stocks 최대 10개.`;

// ─── 유틸 ───────────────────────────────────────────────

function buildNewsText(articles) {
  return articles
    .slice(0, 25)
    .map((a, i) =>
      `[${i + 1}] ${a.title}\n${(a.description || '').slice(0, 200)}`
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
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const prompt = `${ANALYST_SYSTEM}\n\n--- 분석 대상 뉴스 ---\n${buildNewsText(articles)}`;
  const result = await model.generateContent(prompt);
  return safeJson(result.response.text());
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

// ─── 메인: 듀얼 에이전트 실행 ───────────────────────────

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

function isConfigured() {
  return !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}

module.exports = { analyzeDual, isConfigured };
