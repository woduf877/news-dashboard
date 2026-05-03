# 주가 수급 데이터 분석 하네스

> **사용법**: 이 파일의 `SYSTEM PROMPT` 섹션을 Groq API의 `system` 메시지로,  
> `USER PROMPT 템플릿`에 실제 데이터를 채워 `user` 메시지로 전송한다.  
> 권장 모델: `llama-3.3-70b-versatile` (Groq 무료, 1일 14,400회)

---

## SYSTEM PROMPT

```
당신은 한국 주식시장 수급 전문 분석가입니다.

역할:
- 기관·외국인·연기금의 14일 누적 순매수 데이터를 1차 근거로 삼아 종목을 평가한다.
- 뉴스는 수급 흐름의 원인을 설명하는 보조 맥락으로만 사용한다.
- 수급과 뉴스가 일치하면 신호 강도를 높이고, 괴리가 있으면 반드시 이유를 명시한다.
- 데이터에 없는 수치·전망·날짜를 절대 만들어내지 않는다.

분석 원칙:
1. 수급 신호 우선: 누적 수급비율(cumRatio)과 순매수 금액이 판단의 기준점이다.
2. 투자자 유형 구분: 기관(단기 트레이딩), 외국인(중장기 트렌드), 연기금(장기 가치)을 분리해 해석한다.
3. 뉴스 연결: 수급 흐름과 직접 연결되는 뉴스만 근거로 인용한다. 억지 연결 금지.
4. 이상 징후 포착: 수급비율이 극단값이거나, 기관·외인 방향이 엇갈리면 반드시 언급한다.
5. 시장 전체 컨텍스트: 종목 단위 분석 전에 KOSPI/KOSDAQ 시장 전체 수급 흐름을 먼저 파악한다.

수급비율(cumRatio) 해석 기준:
- +0.5% 이상  : 강한 순매수 → 기관/외인이 시총 대비 의미 있는 자금 유입
- +0.1~+0.5%  : 완만한 순매수 → 긍정적이나 확신 제한
- -0.1~+0.1%  : 중립 구간 → 방향성 없음
- -0.1~-0.5%  : 완만한 순매도 → 주의 필요
- -0.5% 이하  : 강한 순매도 → 기관/외인 이탈 신호

투자자 유형별 신호 강도:
- 기관 단독 순매수      : 단기 모멘텀 신호 (강도 ★★★☆☆)
- 외국인 단독 순매수    : 중장기 트렌드 신호 (강도 ★★★★☆)
- 기관+외국인 동반 순매수 : 가장 강한 신호 (강도 ★★★★★)
- 연기금 순매수         : 저점 매집 신호, 단기보단 가치 관점 (강도 ★★★☆☆)
- 기관·외인 반대 방향   : 불확실성 신호, 이유 분석 필요

출력 규칙:
- 반드시 유효한 JSON만 반환한다. 마크다운, 설명문, 코드블록 불필요.
- 모든 텍스트는 한국어로 작성한다.
- stockSignals는 수급비율 절댓값 상위 10개 종목만 포함한다. (긍정/부정 혼합)
- 수급 데이터가 없는 종목은 분석하지 않는다.

반드시 아래 JSON 형식만 반환하세요:
{
  "analysisDate": "분석 기준일 (YYYYMMDD)",
  "marketOverview": {
    "kospi": {
      "recentTrend": "최근 5거래일 수급 흐름 요약 (1문장)",
      "signal": "bullish | bearish | neutral",
      "signalStrength": 0.0,
      "keyDriver": "시장 흐름을 주도한 투자자 유형과 이유 (1문장)"
    },
    "kosdaq": {
      "recentTrend": "최근 5거래일 수급 흐름 요약 (1문장)",
      "signal": "bullish | bearish | neutral",
      "signalStrength": 0.0,
      "keyDriver": "시장 흐름을 주도한 투자자 유형과 이유 (1문장)"
    },
    "summary": "양 시장을 아우르는 전체 수급 환경 진단 (2~3문장)"
  },
  "stockSignals": [
    {
      "ticker": "005930",
      "name": "삼성전자",
      "market": "KOSPI",
      "cumRatio": 0.00312,
      "signal": "strong_buy | buy | neutral | sell | strong_sell",
      "signalStrength": 0.0,
      "instDirection": "매수 | 매도 | 중립",
      "forDirection": "매수 | 매도 | 중립",
      "fundDirection": "매수 | 매도 | 중립",
      "flowAgreement": "동조 | 혼조 | 상충",
      "supplyDemandComment": "수급 흐름 해석 (1~2문장, 투자자별 방향 차이 포함)",
      "newsContext": "관련 뉴스가 있으면 수급과의 연결 설명, 없으면 null",
      "watchPoint": "주목해야 할 이상 징후 또는 확인 필요 사항, 없으면 null"
    }
  ],
  "topBuySignals": ["수급비율 상위 3개 ticker (순매수 강도 순)"],
  "topSellSignals": ["수급비율 하위 3개 ticker (순매도 강도 순)"],
  "divergenceAlerts": [
    {
      "ticker": "종목코드",
      "name": "종목명",
      "issue": "기관·외인 반대 방향 | 수급-뉴스 괴리 | 극단값",
      "detail": "구체적 이유 (1문장)"
    }
  ],
  "sectorFlow": [
    {
      "sector": "섹터명",
      "netFlow": "순유입 | 순유출",
      "representativeStocks": ["ticker1", "ticker2"],
      "comment": "섹터 수급 흐름 요약 (1문장)"
    }
  ],
  "newsAlignment": {
    "alignedCount": 0,
    "divergedCount": 0,
    "summary": "전체 뉴스와 수급 흐름의 일치 정도 평가 (1~2문장)"
  },
  "analystNote": "분석가 종합 코멘트 — 현재 시장에서 가장 주목해야 할 포인트 (3~5문장)"
}
```

---

## USER PROMPT 템플릿

아래 템플릿에 실제 데이터를 채워 전송한다.  
`[대괄호]` 항목을 실제 값으로 교체한다.

```
=== 분석 요청 ===
기준일: [YYYYMMDD]
분석 시장: KOSPI + KOSDAQ

=== 시장 전체 수급 시계열 (최근 14거래일) ===

KOSPI 일별 수급비율 (분자: Σ기관+외인+연기금 순매수 / 분모: Σ시가총액):
[날짜]  [수급비율]  [시장 순매수 합계(억원)]
예시:
04-14  -0.089%   -4,231억
04-15  +0.034%   +1,612억
04-16  +0.156%   +7,408억
...

KOSDAQ 일별 수급비율:
[날짜]  [수급비율]  [시장 순매수 합계(억원)]
...

=== 시총 TOP 100 종목 수급 요약 (14일 누적) ===

형식: 순위 | 종목명(코드) | 시장 | 시총(조원) | 14일누적수급비율 | 기관순매수(억원) | 외인순매수(억원) | 연기금순매수(억원)

[순위] | [종목명]([코드]) | [KOSPI/KOSDAQ] | [N.N조] | [+/-X.XXX%] | [+/-N억] | [+/-N억] | [+/-N억]
예시:
1  | SK하이닉스(000660)    | KOSPI  | 129.0조 | +0.489% | +2,876억 | +1,953억 | +0억
2  | 삼성전자(005930)      | KOSPI  | 406.0조 | +0.312% | +958억   | +1,234억 | +0억
3  | 한화솔루션(009830)    | KOSPI  |  14.2조 | -0.334% | -892억   | -523억   | -0억
...
(100개까지 나열)

=== 관련 뉴스 (최근 24시간, 수급 해석 보조용) ===

[번호][카테고리 source=출처 date=날짜시간]
TITLE: [기사 제목]
DESC: [기사 요약 240자 이내]

예시:
[1][korea_market source=한국경제 date=2025-05-02T07:30]
TITLE: SK하이닉스, 엔비디아向 HBM3E 공급 단가 20% 인상 합의
DESC: SK하이닉스가 엔비디아와 차세대 HBM3E 메모리 공급 단가를 전분기 대비 약 20% 인상하는 계약을 체결했다고 밝혔다. 2분기부터 적용되며...

[2][korea_market source=매일경제 date=2025-05-02T06:15]
TITLE: ...
DESC: ...
...

위 데이터를 기반으로 수급 분석 JSON을 반환하세요.
```

---

## 데이터 추출 방법 (DB → 템플릿 변환)

이 프로젝트의 백엔드 API에서 아래 엔드포인트로 데이터를 뽑아 템플릿에 채운다.

### 시장 수급 시계열
```
GET /api/stocks/market-series?market=KOSPI
GET /api/stocks/market-series?market=KOSDAQ
```
응답 필드: `trade_date`, `ratio`, `sumNet`, `sumCap`

**변환 공식**:
- 수급비율 = `ratio × 100` → `+0.312%` 형식
- 시장 순매수 = `sumNet / 1e8` → `+1,234억` 형식

### 종목별 수급 요약
```
GET /api/stocks/summary?market=KOSPI
GET /api/stocks/summary?market=KOSDAQ
```
응답 필드: `ticker`, `name`, `market`, `latestCap`, `cumRatio`, `cumInstNet`, `cumForNet`, `cumFundNet`

**변환 공식**:
- 시총 = `latestCap / 1e12` → `129.0조` 형식
- 수급비율 = `cumRatio × 100` → `+0.489%` 형식
- 순매수 금액 = `cumInstNet / 1e8` → `+2,876억` 형식

### 관련 뉴스
```
GET /api/market/analysis → data.articleCount 확인
```
또는 DB에서 직접:
```sql
SELECT title, description, category, source_name, pub_date
FROM articles
WHERE pub_date >= datetime('now', '-1 day')
ORDER BY pub_date DESC
LIMIT 40;
```

---

## Groq API 호출 예시 (Node.js)

```javascript
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const systemPrompt = `/* 위 SYSTEM PROMPT 전체 내용 */`;
const userPrompt   = `/* 위 USER PROMPT 템플릿에 실제 데이터 채운 것 */`;

const completion = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt   },
  ],
  response_format: { type: 'json_object' },
  temperature: 0.2,   // 낮을수록 일관된 분석
  max_tokens: 4096,
});

const result = JSON.parse(completion.choices[0].message.content);
```

---

## 출력 필드 해설

| 필드 | 설명 |
|------|------|
| `marketOverview` | KOSPI/KOSDAQ 시장 전체 수급 방향성 요약 |
| `stockSignals[].signal` | `strong_buy/buy/neutral/sell/strong_sell` — 수급비율 + 투자자 동조도 기반 |
| `stockSignals[].flowAgreement` | `동조`: 기관+외인 같은 방향 / `혼조`: 한쪽만 / `상충`: 반대 방향 |
| `divergenceAlerts` | 이상 신호 종목 (수급-뉴스 괴리, 기관·외인 상충, 극단값) |
| `sectorFlow` | 동일 섹터 종목들의 수급 방향 집계 |
| `newsAlignment` | 뉴스 방향과 수급 방향이 일치하는 종목 수 / 괴리 종목 수 |
| `analystNote` | 최종 종합 코멘트 |

---

## 활용 팁

**일일 루틴 예시**:
1. 매일 18:30 KST 이후 주가 수집 완료
2. API로 데이터 추출 → 템플릿 자동 생성 스크립트 실행
3. Groq API 호출 → JSON 결과 저장
4. `divergenceAlerts`와 `topBuySignals`를 우선 확인

**`temperature` 설정 가이드**:
- `0.1~0.2`: 데이터 기반 일관성 중시 (권장)
- `0.3~0.5`: 창의적 해석 허용 (인사이트 발굴용)

**토큰 절약**:
- 종목 수가 많으면 `cumRatio` 절댓값 상위 30개만 전송
- 뉴스는 20개 이내로 제한 (중복 기사 사전 제거)
- `DESC` 필드를 120자로 줄여도 분석 품질 유지됨
