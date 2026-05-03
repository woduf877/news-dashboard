# News Dashboard

뉴스, 키워드, 증시 AI 분석, 국내 주가 수급 데이터를 한 화면에서 보는 개인용 대시보드입니다.

RSS 뉴스를 정기 수집하고, 한국/미국 증시 뉴스는 AI가 요약·교차검증합니다. 한국 증시 분석은 뉴스뿐 아니라 KIS Open API로 수집한 KOSPI/KOSDAQ 시총 TOP150의 최근 14거래일 수급 흐름도 함께 참고합니다.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)

## Features

- 뉴스 대시보드: 세계, 기술, 비즈니스, 과학, 건강, 스포츠 뉴스 RSS 수집
- 키워드 분석: 워드클라우드, 히트맵, TOP 키워드, 트렌드 차트
- 한국/미국 증시 분석: Gemini/Groq 기반 복수 실행 결과를 종합해 시장 심리, 종목, 섹터, 테마 분석
- 한국 증시 수급 반영: KOSPI/KOSDAQ 수급 흐름을 AI 분석 프롬프트에 함께 제공
- 주가 데이터: KOSPI/KOSDAQ 시총 TOP150의 최근 14거래일 종가, 시총, 외국인/기관/연기금 순매수 수집
- 주가 정렬: 수급 비율, 합계 순매수, 외국인, 기관, 연기금 기준 오름차순/내림차순 정렬
- 수집 상태 표시: 주가 수집 중이면 프론트엔드에서 진행 상태 표시
- Raw export: 시장별 주가 원천 데이터를 CSV로 다운로드

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Backend | Node.js, Express |
| Database | SQLite, better-sqlite3 |
| Scheduler | node-cron |
| News Crawler | rss-parser, axios |
| Stock Data | Korea Investment Open API |
| AI | Gemini, Groq |

## Project Structure

```text
news-dashboard/
├── backend/
│   ├── data/                  # SQLite DB, KIS token cache
│   └── src/
│       ├── server.js          # Express API + static frontend serving
│       ├── crawler.js         # RSS news collector
│       ├── scheduler.js       # scheduled crawl / analysis / stock collection
│       ├── db.js              # SQLite schema and queries
│       ├── keywords.js        # keyword extraction and market windows
│       ├── marketAnalyzer.js  # AI market analysis workflow
│       ├── aiAgent.js         # Gemini/Groq calls and aggregation
│       ├── aiPromptHarness.js # prompt harness for market analysis
│       └── stockCollector.js  # KIS stock and investor-flow collector
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── pages/
│       │   ├── Analytics.jsx
│       │   ├── Market.jsx
│       │   └── StockData.jsx
│       └── components/
├── ecosystem.config.js        # PM2 process config
└── README.md
```

## Quick Start

```bash
git clone https://github.com/woduf877/news-dashboard.git
cd news-dashboard
npm run install:all
```

개발 환경은 백엔드와 프론트엔드를 각각 실행합니다.

```bash
npm run dev:backend
npm run dev:frontend
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`

통합 실행은 프론트엔드를 먼저 빌드한 뒤 백엔드가 `backend/public`을 정적 서빙합니다.

```bash
npm run build
npm start
```

포트를 바꿔 실행하려면 다음처럼 실행합니다.

```bash
PORT=3002 npm start
```

## Environment

`backend/.env`를 생성하고 필요한 키를 설정합니다.

```env
PORT=3001

# AI market analysis
AI_PROVIDER=gemini
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
| Every day 08:00 | 뉴스 크롤링 후 증시 AI 분석 |
| Every day 13:00 | 뉴스 크롤링 후 증시 AI 분석 |
| Mon-Fri 18:30 | KOSPI/KOSDAQ TOP150 주가 수급 수집 |

## Stock Data Rules

- 대상 시장: KOSPI, KOSDAQ
- 대상 종목: 시장별 시가총액 TOP150 일반주
- 수집 기간: 최근 14거래일
- 가격 기준: KIS 일별 종가
- 수급 기준: 외국인, 기관, 연기금 순매수 거래대금
- 기관 기준: `기관 = 기관계 - 연기금`
- 부족 데이터 처리: 기존 데이터가 없거나 날짜별 TOP150 수량이 부족하면 필요한 날짜만 다시 수집
- 스키마 변경 대응: 외국인/기관/연기금 분해 컬럼이 없는 기존 데이터는 불완전 데이터로 보고 재수집

## Main APIs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/news` | 기사 목록 |
| `GET` | `/api/categories` | 카테고리별 기사 수 |
| `GET` | `/api/status` | 마지막/다음 크롤 상태 |
| `POST` | `/api/crawl` | 뉴스 수동 수집 |
| `GET` | `/api/analytics/wordcloud` | 워드클라우드 |
| `GET` | `/api/analytics/heatmap` | 키워드 히트맵 |
| `GET` | `/api/analytics/top` | TOP 키워드 |
| `GET` | `/api/analytics/trends` | 키워드 트렌드 |
| `GET` | `/api/market/analysis` | 최신 증시 AI 분석 |
| `POST` | `/api/market/analyze` | 증시 AI 분석 수동 실행 |
| `GET` | `/api/stocks/summary` | 시장별 TOP150 누적 수급 |
| `GET` | `/api/stocks/market-series` | 시장 전체 일별 수급 비율 |
| `GET` | `/api/stocks/series/:ticker` | 종목별 14일 수급 시계열 |
| `GET` | `/api/stocks/raw-export` | 시장별 주가 raw CSV 다운로드 |
| `POST` | `/api/stocks/collect` | 주가 데이터 수동 수집 |
| `GET` | `/api/stocks/collect-status` | 주가 수집 상태 |
| `GET` | `/api/stocks/diagnose` | KIS 토큰/API 필드 진단 |

## Deploy

PM2를 사용해 백엔드 서버를 상시 실행할 수 있습니다.

```bash
npm run install:all
npm run build
pm2 start ecosystem.config.js
pm2 save
```

프론트엔드 소스가 바뀌면 반드시 `npm run build`를 실행해 `backend/public`을 갱신한 뒤 서버를 재시작합니다. 백엔드 소스가 바뀐 경우에도 PM2 프로세스를 재시작해야 합니다.
