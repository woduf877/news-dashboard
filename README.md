# 📰 글로벌 뉴스 대시보드

매일 **오전 8시 · 오후 1시** (KST) 전 세계 뉴스를 자동 수집해 보여주는 반응형 웹 대시보드입니다.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)

---

## 주요 기능

- **자동 크롤링** — node-cron으로 하루 2회 (08:00 · 13:00 KST) RSS 수집
- **20개 뉴스 소스** — BBC, Al Jazeera, Guardian, TechCrunch, Verge, Wired, CNBC, NASA, ESPN 등
- **6개 카테고리** — 세계 / 기술 / 비즈니스 / 과학 / 건강 / 스포츠
- **반응형 UI** — 모바일·태블릿·데스크탑 완전 지원
- **다크모드** — 시스템 설정 자동 감지 + 수동 토글
- **수동 수집** — 헤더의 "지금 수집" 버튼으로 즉시 실행
- **자동 정리** — 7일이 지난 기사는 자동 삭제

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프론트엔드 | React 18, Vite, Tailwind CSS |
| 백엔드 | Node.js, Express |
| 크롤러 | rss-parser, axios |
| 스케줄러 | node-cron |
| 데이터베이스 | SQLite (better-sqlite3) |
| 배포 | PM2 (맥미니 서버) |

---

## 프로젝트 구조

```
news-dashboard/
├── backend/
│   └── src/
│       ├── server.js       # Express API + 정적 파일 서빙
│       ├── crawler.js      # RSS 크롤러 (20개 소스)
│       ├── scheduler.js    # 오전 8시·오후 1시 자동 실행
│       └── db.js           # SQLite CRUD
├── frontend/
│   └── src/
│       ├── App.jsx
│       └── components/
│           ├── Header.jsx          # 상태바 + 다크모드 + 수동수집
│           ├── CategoryFilter.jsx  # 카테고리 탭
│           ├── NewsGrid.jsx        # 반응형 카드 그리드
│           └── NewsCard.jsx        # 개별 기사 카드
├── ecosystem.config.js     # PM2 배포 설정
└── DEPLOY.md               # 맥미니 배포 상세 가이드
```

---

## 빠른 시작

### 개발 환경

```bash
# 1. 클론
git clone https://github.com/woduf877/news-dashboard.git
cd news-dashboard

# 2. 백엔드 의존성 설치 및 실행
cd backend && npm install && npm run dev

# 3. 새 터미널에서 프론트엔드 실행
cd frontend && npm install && npm run dev
```

- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:3001

### 프로덕션 (맥미니)

```bash
# 빌드 + PM2로 서버 시작
cd frontend && npm run build && cd ..
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

자세한 배포 방법은 [DEPLOY.md](./DEPLOY.md)를 참고하세요.

---

## API

| 메서드 | 엔드포인트 | 설명 |
|---|---|---|
| GET | `/api/news` | 기사 목록 (`?category=technology&limit=60`) |
| GET | `/api/categories` | 카테고리별 기사 수 |
| GET | `/api/status` | 마지막·다음 크롤 시각, 소스 수 |
| GET | `/api/crawl-logs` | 크롤 이력 |
| POST | `/api/crawl` | 수동 크롤 트리거 |

---

## 뉴스 소스

| 카테고리 | 소스 |
|---|---|
| 세계 | BBC World, Al Jazeera, NPR World, The Guardian, DW News |
| 기술 | TechCrunch, The Verge, Ars Technica, Wired, Hacker News |
| 비즈니스 | BBC Business, MarketWatch, CNBC |
| 과학 | BBC Science, Science Daily, NASA |
| 건강 | BBC Health, Medical Xpress |
| 스포츠 | BBC Sport, ESPN |
