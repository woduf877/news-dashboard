# News Dashboard

주가 데이터와 한국/미국 증시 AI 분석을 중심으로 보는 개인용 마켓 대시보드입니다.

뉴스는 더 이상 별도 화면으로 노출하지 않고, 한국/미국 증시 분석을 위한 백데이터로만 수집합니다. 한국 증시 분석은 KIS Open API로 수집한 KOSPI/KOSDAQ 시총 TOP150의 최근 14거래일 수급 흐름도 함께 참고합니다.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)

## Features

- 첫 화면: `주가 데이터`
- 노출 탭: `주가 데이터`, `한국 증시`, `미국 증시`
- 숨김/제거: 일반 뉴스 화면, 키워드 분석 화면, 키워드 분석 API
- 주가 데이터: KOSPI/KOSDAQ 시총 TOP150의 최근 14거래일 종가, 시총, 외국인/기관/연기금 순매수 수집
- 주가 정렬: 수급 비율, 합계 순매수, 외국인, 기관, 연기금 기준 오름차순/내림차순 정렬
- Raw export: 시장별 주가 원천 데이터를 CSV로 다운로드
- 수집 상태 표시: 주가 수집 중이면 프론트엔드에서 진행 상태 표시
- Groq 수급 분석: `stock-analysis-harness.md`를 시스템 컨텍스트로 사용하는 별도 주식 분석 에이전트
- 한국/미국 증시 분석: Gemini 1차 분석 + Groq 리뷰를 3회 반복 실행하고 종합해 시장 심리, 종목, 섹터, 테마 분석
- 한국 증시 수급 반영: KOSPI/KOSDAQ 수급 흐름을 AI 분석 프롬프트에 함께 제공
- 뉴스 백데이터: 한국/미국 증시 RSS만 수집해 AI 분석 입력으로 사용

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Backend | Node.js, Express |
| Database | SQLite, better-sqlite3 |
| Scheduler | node-cron |
| News Backdata | rss-parser, axios |
| Stock Data | Korea Investment Open API |
| AI | Gemini, Groq |

## Current App Shape

- `frontend/src/App.jsx`는 `stock_data` 탭을 기본 탭으로 사용합니다.
- 뉴스와 키워드 분석 컴포넌트는 프론트엔드에서 제거되었습니다.
- 백엔드는 뉴스 기사를 `articles` 테이블에 저장하지만 `/api/news`, `/api/categories`, `/api/analytics/*`는 제공하지 않습니다.
- 존재하지 않는 `/api/*` 요청은 SPA fallback 대신 JSON 404를 반환합니다.
- `keyword_stats` 관련 생성/조회/재계산 로직은 제거되었습니다.

## Project Structure

```text
news-dashboard/
├── backend/
│   ├── data/                   # SQLite DB, KIS token cache
│   └── src/
│       ├── server.js           # Express API + static frontend serving
│       ├── crawler.js          # market-news backdata collector
│       ├── scheduler.js        # scheduled crawl / analysis / stock collection
│       ├── db.js               # SQLite schema and queries
│       ├── marketWindow.js     # market analysis time-window helper
│       ├── marketAnalyzer.js   # AI market analysis workflow
│       ├── aiAgent.js          # Gemini/Groq calls and aggregation
│       ├── aiPromptHarness.js  # prompt harness for market analysis
│       ├── stockAnalysisAgent.js # Groq stock-flow analysis agent
│       └── stockCollector.js   # KIS stock and investor-flow collector
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── pages/
│       │   ├── Market.jsx
│       │   └── StockData.jsx
│       └── components/
├── ecosystem.config.js         # PM2 process config
├── stock-analysis-harness.md   # Groq stock analysis system prompt
└── README.md
```

## Quick Start

```bash
git clone https://github.com/woduf877/news-dashboard.git
cd news-dashboard
npm run install:all
```

개발 환경은 백엔드와 프론트엔드를 각각 실행합니다.
개발 프론트엔드의 `/api` proxy는 기본 백엔드 포트 `3001`을 바라봅니다.

```bash
npm run dev:backend
npm run dev:frontend
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`

통합 실행은 프론트엔드를 먼저 빌드한 뒤 백엔드가 `backend/public`을 정적 서빙합니다.
기본 포트는 포트포워딩 기준에 맞춘 `3001`입니다.

```bash
npm run build
npm start
```

브라우저 접속 주소: `http://localhost:3001`

## Environment

`backend/.env`를 생성하고 필요한 키를 설정합니다.

```env
PORT=3001

# AI market analysis: Gemini analyst + Groq reviewer
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key

# Korea Investment Open API
KIS_APP_KEY=your_kis_app_key
KIS_APP_SECRET=your_kis_app_secret
```

AI 키가 없으면 증시 AI 분석은 실행되지 않습니다. KIS 키가 없으면 주가 데이터 수집과 KIS 진단 API가 동작하지 않습니다.

## Schedules

| Time (KST) | Job |
|---|---|
| Every day 08:00 | 한국/미국 증시 뉴스 백데이터 수집 후 증시 AI 분석 |
| Every day 13:00 | 한국/미국 증시 뉴스 백데이터 수집 후 증시 AI 분석 |
| Mon-Fri 18:30 | KOSPI/KOSDAQ TOP150 주가 수급 수집 |

## Stock Data Rules

- 대상 시장: KOSPI, KOSDAQ
- 대상 종목: 시장별 시가총액 TOP150 일반주
- 수집 기간: 최근 14거래일
- 가격 기준: KIS 일별 종가
- 수급 기준: 외국인, 기관, 연기금 순매수 거래대금
- 기관 기준: `기관 = 기관계 - 연기금`
- 수급 비율: `(14일 외국인 순매수 + 14일 기관 순매수 + 14일 연기금 순매수) / 최신 시가총액`
- 부족 데이터 처리: 기존 데이터가 없거나 날짜별 TOP150 수량이 부족하면 필요한 날짜만 다시 수집
- 정리 기준: KOSPI/KOSDAQ 각각 최신 14거래일만 유지
- 스키마 변경 대응: 외국인/기관/연기금 분해 컬럼이 없는 기존 데이터는 불완전 데이터로 보고 재수집
- 중복 수집 방지: 백엔드 수집 상태 플래그와 `/api/stocks/collect-status`로 실행 여부를 추적
- CSV 다운로드: 엑셀 수식 주입 방어를 적용한 UTF-8 BOM CSV

## Main APIs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | 마지막/다음 크롤 상태 |
| `GET` | `/api/crawl-logs` | 뉴스 백데이터 수집 로그 |
| `POST` | `/api/crawl` | 뉴스 백데이터 수동 수집 |
| `GET` | `/api/market/analysis` | 최신 증시 AI 분석 |
| `POST` | `/api/market/analyze` | 증시 AI 분석 수동 실행 |
| `GET` | `/api/market/hourly` | 분석 시간창 기사 수 |
| `GET` | `/api/stocks/summary` | 시장별 TOP150 누적 수급 |
| `GET` | `/api/stocks/market-series` | 시장 전체 일별 수급 비율 |
| `GET` | `/api/stocks/series/:ticker` | 종목별 14일 수급 시계열 |
| `GET` | `/api/stocks/raw-export` | 시장별 주가 raw CSV 다운로드 |
| `POST` | `/api/stocks/collect` | 주가 데이터 수동 수집 |
| `GET` | `/api/stocks/collect-status` | 주가 수집 상태 |
| `GET` | `/api/stocks/diagnose` | KIS 토큰/API 필드 진단 |
| `POST` | `/api/stocks/ai-analysis` | Groq 기반 주가 수급 분석 |

## AI Analysis Rules

- 주가 데이터 탭의 Groq 수급 분석은 한국/미국 증시 리뷰어와 별개인 `stockAnalysisAgent`가 처리합니다.
- `stockAnalysisAgent`는 `stock-analysis-harness.md`의 `SYSTEM PROMPT`를 Groq system 메시지로 사용합니다.
- Groq 무료 API 한도에 맞춰 시장별 대표 35개 종목과 최근 뉴스 12건을 압축 컨텍스트로 전송합니다.
- Gemini와 Groq 중 하나라도 성공하면 분석 결과를 저장합니다.
- 3회 실행이 모두 실패하면 `market_analysis.status = error`로 저장합니다.
- 한국 증시 분석에는 KOSPI/KOSDAQ 시장 수급비율, 강한 순매수/순매도 상위 종목 텍스트가 프롬프트에 포함됩니다.
- 한국 증시 화면에는 AI가 주가 데이터 동향을 어떻게 반영했는지 별도 인사이트 패널을 표시합니다.
- 오래된 `pending` 분석은 프론트엔드에서 영구 잠금으로 처리하지 않습니다.

## Reliability Notes

- RSS guid fallback에는 발행일을 포함해 제목 중복 저장 누락 가능성을 줄입니다.
- 뉴스/AI 스케줄은 크롤 또는 분석 실패를 로깅하고 다음 스케줄을 막지 않습니다.
- 주가 수집의 가격 조회와 일별 수급 조회는 실패 시 최대 3회 재시도합니다.
- 통합 실행 기본 포트는 `3001`입니다. 포트포워딩과 PM2 설정도 이 포트를 기준으로 맞춥니다.

## Deploy

PM2를 사용해 백엔드 서버를 상시 실행할 수 있습니다.

```bash
npm run install:all
npm run build
pm2 start ecosystem.config.js
pm2 save
```

프론트엔드 소스가 바뀌면 반드시 `npm run build`를 실행해 `backend/public`을 갱신한 뒤 서버를 재시작합니다. 백엔드 소스가 바뀐 경우에도 PM2 프로세스를 재시작해야 합니다.
