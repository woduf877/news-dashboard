/**
 * AI 시장 분석 프롬프트 하네스
 *
 * 목표:
 * - Gemini/Groq가 같은 출력 계약을 따르게 한다.
 * - 뉴스와 직접 연결되지 않은 종목 추천을 줄인다.
 * - 한국/미국 증시를 분리해서 판단한 뒤 교차 영향을 합친다.
 */

const STOCK_UNIVERSE = `
KOSPI: 삼성전자(005930), SK하이닉스(000660), LG에너지솔루션(373220), 현대차(005380),
기아(000270), POSCO홀딩스(005490), LG화학(051910), 삼성바이오로직스(207940),
삼성SDI(006400), KB금융(105560), 신한지주(055550), 하나금융지주(086790),
한국전력(015760), 셀트리온(068270), NAVER(035420), 카카오(035720),
HD현대중공업(329180), 한화에어로스페이스(012450), LG전자(066570)

KOSDAQ: 에코프로비엠(247540), 에코프로(086520), 알테오젠(196170),
HLB(028300), 리가켐바이오(141080), 레인보우로보틱스(277810),
삼천당제약(000250), 리노공업(058470), 펩트론(087010), ISC(095340)

NYSE/NASDAQ: Apple(AAPL), Microsoft(MSFT), NVIDIA(NVDA), Amazon(AMZN),
Alphabet(GOOGL), Meta(META), Tesla(TSLA), Berkshire(BRK.B), JPMorgan(JPM),
Visa(V), ExxonMobil(XOM), Johnson&Johnson(JNJ), Netflix(NFLX), AMD(AMD),
Intel(INTC), Qualcomm(QCOM), Broadcom(AVGO), TSMC(TSM)
`;

const JSON_SCHEMA = `
{
  "summary": "전체 뉴스 핵심 테마 요약 (2~3문장, 한국어)",
  "sentiment": "bullish | bearish | neutral",
  "sentimentReason": "한국·미국 시장 방향성을 분리해서 설명하고, 마지막에 교차 영향을 언급 (1~2문장)",
  "stocks": [
    {
      "ticker": "005930 또는 NVDA",
      "name": "삼성전자 또는 NVIDIA",
      "market": "KOSPI | KOSDAQ | NYSE | NASDAQ",
      "impact": "positive | negative | neutral",
      "score": 0.0,
      "reason": "뉴스와 이 종목의 연결고리 및 예상 주가 영향 (1~2문장, 한국어)",
      "relatedNews": ["관련 뉴스 제목"]
    }
  ],
  "sectors": [
    { "name": "섹터명", "impact": "positive | negative | neutral", "reason": "근거" }
  ],
  "themes": ["핵심 테마1", "핵심 테마2"],
  "crossMarketInsight": "미국 증시가 한국 증시에 미치는 영향 또는 공통 테마 (1~2문장, 한국어)",
  "koreaStockTrendInsight": "한국 주가 데이터의 최근 수급비율, 순매수/순매도 상위 종목을 분석에 어떻게 반영했는지 (1~2문장, 한국어)"
}
`;

const REVIEW_SCHEMA = `
{
  "agreement": "agree | partial | disagree",
  "agreementScore": 0.0,
  "reviewSummary": "Gemini 분석에 대한 평가 (2~3문장, 한국어)",
  "summary": "리뷰어 자체 뉴스 분석 요약 (2~3문장, 한국어)",
  "sentiment": "bullish | bearish | neutral",
  "sentimentReason": "한국·미국 시장 방향성을 분리해서 설명하고, 마지막에 교차 영향을 언급 (1~2문장)",
  "stocksAgreed": ["동의하는 ticker"],
  "stocksDisagreed": [
    { "ticker": "ticker", "reason": "동의하지 않는 이유" }
  ],
  "stocks": [
    {
      "ticker": "005930 또는 NVDA",
      "name": "종목명",
      "market": "KOSPI | KOSDAQ | NYSE | NASDAQ",
      "impact": "positive | negative | neutral",
      "score": 0.0,
      "reason": "리뷰어 자체 영향 근거 (1~2문장, 한국어)",
      "relatedNews": ["관련 뉴스 제목"]
    }
  ],
  "sectors": [
    { "name": "섹터명", "impact": "positive | negative | neutral", "reason": "근거" }
  ],
  "themes": ["핵심 테마1", "핵심 테마2"],
  "crossMarketInsight": "미국 증시가 한국 증시에 미치는 영향 또는 공통 테마 (1~2문장, 한국어)",
  "koreaStockTrendInsight": "리뷰어 자체 관점에서 한국 주가 데이터 동향이 시사하는 점 (1~2문장, 한국어)",
  "koreaStockTrendReview": "Gemini가 한국 주가 데이터 동향을 적절히 반영했는지에 대한 평가 (1~2문장, 한국어)",
  "additionalInsights": "Gemini가 놓친 추가 인사이트 또는 null"
}
`;

const ANALYSIS_RULES = `
분석 절차:
1. 뉴스 제목과 설명에서 실제 이벤트를 추출한다. 단순 시장 소음, 일반 해설, 중복 기사는 낮은 가중치로 본다.
2. [korea_market] 뉴스는 한국 상장사와 원화/수출/정책/업종 영향을 우선 판단한다.
3. [us_market] 뉴스는 미국 상장사와 금리/달러/반도체/AI/소비/에너지 흐름을 우선 판단한다.
4. 양 시장이 연결되는 경우만 crossMarketInsight에 적는다. 억지 연결은 금지한다.
5. 종목은 뉴스와 직접 연결된 경우만 포함한다. 단순히 대형주라는 이유로 넣지 않는다.
6. stocks는 한국·미국 합산 최대 12개로 제한한다. 확신이 낮으면 빼는 쪽을 선택한다.

점수 기준:
- 0.80~1.00: 특정 회사의 실적, 수주, 규제, 제품, 공급망과 직접 연결
- 0.60~0.79: 특정 업종 또는 밸류체인 영향이 분명하고 대표 종목 연결이 강함
- 0.40~0.59: 거시 변수 또는 업종 심리 영향. 이유에 불확실성을 명시
- 0.00~0.39: 포함하지 말 것

출력 규칙:
- 반드시 유효한 JSON만 반환한다. 마크다운, 설명문, 코드블록 금지.
- 모든 설명은 한국어로 쓴다.
- ticker는 종목코드만 쓴다. 예: 삼성전자는 "005930", NVIDIA는 "NVDA".
- relatedNews에는 입력 뉴스 제목과 동일하거나 매우 가까운 제목만 넣는다.
- 모르는 사실을 보태지 않는다. 기사에 없는 실적 수치, 전망치, 날짜를 만들지 않는다.
- 한국 증시 수급 동향 참고 데이터가 제공되면 koreaStockTrendInsight를 반드시 채운다.
`;

const ANALYST_SYSTEM = `
당신은 한국·미국 주식시장 전문 분석가입니다.
뉴스를 읽고 다음 장 시작 전까지 영향을 줄 수 있는 시장 방향성, 섹터, 종목을 판단합니다.

${ANALYSIS_RULES}

주요 종목 참고:
${STOCK_UNIVERSE}

반드시 아래 JSON 형식만 반환하세요:
${JSON_SCHEMA}
`.trim();

const REVIEWER_SYSTEM = `
당신은 한국·미국 주식시장 수석 리뷰어입니다.
Gemini 분석을 그대로 반복하지 말고, 원본 뉴스를 다시 읽어 독립적으로 검토합니다.

검토 절차:
1. Gemini가 뉴스와 무관한 종목을 넣었는지 제거 관점으로 본다.
2. 한국/미국 시장 방향성 판단이 뉴스 근거와 맞는지 확인한다.
3. 과도한 확신, 과도한 대형주 편향, 누락된 교차시장 영향을 지적한다.
4. 동의하는 종목과 다른 의견을 분리한다.

${ANALYSIS_RULES}

주요 종목 참고:
${STOCK_UNIVERSE}

반드시 아래 JSON 형식만 반환하세요:
${REVIEW_SCHEMA}
`.trim();

function buildNewsDigest(articles, limit = 40) {
  return articles
    .slice(0, limit)
    .map((a, i) => {
      const title = (a.title || '').trim();
      const description = (a.description || '').replace(/\s+/g, ' ').trim().slice(0, 240);
      const source = a.source_name ? ` source=${a.source_name}` : '';
      const date = a.pub_date ? ` date=${String(a.pub_date).slice(0, 16)}` : '';
      return `[${i + 1}][${a.category || 'unknown'}${source}${date}]\nTITLE: ${title}\nDESC: ${description}`;
    })
    .join('\n\n');
}

function buildKoreaTrendSection(promptContext = {}) {
  const text = String(promptContext.koreaStockTrendText || '').trim();
  if (!text) return '';

  return `
한국 증시 수급 동향 참고 데이터 (DB 집계):
${text}

중요:
- 위 데이터는 한국 증시 판단의 보조 근거로 사용한다.
- 뉴스 근거와 수급 데이터가 충돌하면 sentimentReason에 충돌 이유를 짧게 명시한다.
- 한국 종목의 score를 줄 때 최근 수급 추세를 반영하되, 뉴스 직접성 원칙을 우선한다.
`.trim();
}

function buildAnalystPrompt(articles, promptContext = {}) {
  const trendSection = buildKoreaTrendSection(promptContext);
  return `${ANALYST_SYSTEM}${trendSection ? `\n\n${trendSection}` : ''}\n\n--- 분석 대상 뉴스 ---\n${buildNewsDigest(articles)}`;
}

function buildReviewerMessages(articles, geminiResult, promptContext = {}) {
  const trendSection = buildKoreaTrendSection(promptContext);
  return {
    system: REVIEWER_SYSTEM,
    user: `
=== 원본 뉴스 ===
${buildNewsDigest(articles)}

${trendSection ? `${trendSection}\n` : ''}
=== Gemini 1차 분석 결과 ===
${JSON.stringify(geminiResult || {}, null, 2)}

위 두 자료를 비교해 리뷰어 JSON을 반환하세요.
`.trim(),
  };
}

module.exports = {
  buildAnalystPrompt,
  buildNewsDigest,
  buildReviewerMessages,
};
