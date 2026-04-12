const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'news.db'));

// WAL 모드로 성능 향상
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guid        TEXT UNIQUE NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    link        TEXT,
    pub_date    TEXT,
    source_name TEXT,
    category    TEXT,
    crawl_id    INTEGER,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crawl_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at  TEXT DEFAULT (datetime('now')),
    finished_at TEXT,
    total_count INTEGER DEFAULT 0,
    status      TEXT DEFAULT 'running',
    error       TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_articles_category  ON articles(category);
  CREATE INDEX IF NOT EXISTS idx_articles_pub_date  ON articles(pub_date DESC);
  CREATE INDEX IF NOT EXISTS idx_articles_crawl_id  ON articles(crawl_id);

  CREATE TABLE IF NOT EXISTS keyword_stats (
    keyword   TEXT NOT NULL,
    category  TEXT NOT NULL DEFAULT 'all',
    date      TEXT NOT NULL,
    count     INTEGER DEFAULT 0,
    PRIMARY KEY (keyword, category, date)
  );

  CREATE INDEX IF NOT EXISTS idx_kw_date     ON keyword_stats(date DESC);
  CREATE INDEX IF NOT EXISTS idx_kw_category ON keyword_stats(category);

  CREATE TABLE IF NOT EXISTS market_analysis (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    analyzed_at   TEXT DEFAULT (datetime('now')),
    window_from   TEXT,
    window_to     TEXT,
    article_count INTEGER DEFAULT 0,
    status        TEXT DEFAULT 'pending',
    error         TEXT,
    gemini_json   TEXT,
    groq_json     TEXT,
    agreement     TEXT,
    agreement_score REAL
  );
`);

// 크롤 시작 기록
function startCrawl() {
  const info = db.prepare(
    `INSERT INTO crawl_logs (started_at) VALUES (datetime('now'))`
  ).run();
  return info.lastInsertRowid;
}

// 크롤 종료 기록
function finishCrawl(crawlId, totalCount, error = null) {
  db.prepare(`
    UPDATE crawl_logs
    SET finished_at = datetime('now'),
        total_count = ?,
        status = ?,
        error = ?
    WHERE id = ?
  `).run(totalCount, error ? 'error' : 'success', error, crawlId);
}

// 기사 저장 (중복 GUID는 무시)
function saveArticles(articles, crawlId) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO articles
      (guid, title, description, link, pub_date, source_name, category, crawl_id)
    VALUES
      (@guid, @title, @description, @link, @pub_date, @source_name, @category, @crawl_id)
  `);
  const insertMany = db.transaction((items) => {
    let count = 0;
    for (const item of items) {
      const result = insert.run({ ...item, crawl_id: crawlId });
      count += result.changes;
    }
    return count;
  });
  return insertMany(articles);
}

// 기사 조회
function getArticles({ category, limit = 60, offset = 0, date } = {}) {
  let query = `SELECT * FROM articles WHERE 1=1`;
  const params = [];

  if (category && category !== 'all') {
    query += ` AND category = ?`;
    params.push(category);
  }
  if (date) {
    query += ` AND DATE(pub_date) = ?`;
    params.push(date);
  }

  query += ` ORDER BY pub_date DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

// 카테고리별 기사 수
function getCategoryCounts() {
  return db.prepare(`
    SELECT category, COUNT(*) as count
    FROM articles
    GROUP BY category
    ORDER BY count DESC
  `).all();
}

// 최근 크롤 로그
function getCrawlLogs(limit = 10) {
  return db.prepare(`
    SELECT * FROM crawl_logs ORDER BY id DESC LIMIT ?
  `).all(limit);
}

// 마지막 성공 크롤 시각
function getLastCrawlTime() {
  return db.prepare(`
    SELECT finished_at FROM crawl_logs
    WHERE status = 'success'
    ORDER BY id DESC LIMIT 1
  `).get();
}

// 오래된 기사 정리 (7일 초과)
function cleanOldArticles() {
  const result = db.prepare(`
    DELETE FROM articles
    WHERE created_at < datetime('now', '-7 days')
  `).run();
  return result.changes;
}

// ─── 키워드 분석 ──────────────────────────────────────

// 크롤 결과에서 추출한 키워드를 upsert (count 누적)
function upsertKeywords(extracted) {
  const upsert = db.prepare(`
    INSERT INTO keyword_stats (keyword, category, date, count)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(keyword, category, date)
    DO UPDATE SET count = count + excluded.count
  `);
  const run = db.transaction((data) => {
    for (const [date, cats] of Object.entries(data)) {
      for (const [category, freqs] of Object.entries(cats)) {
        for (const [keyword, count] of Object.entries(freqs)) {
          upsert.run(keyword, category, date, count);
        }
      }
    }
  });
  run(extracted);
}

// 워드 클라우드: 기간 내 키워드 총합 top N
function getWordCloud({ category = 'all', days = 30, limit = 80 } = {}) {
  return db.prepare(`
    SELECT keyword, SUM(count) as total
    FROM keyword_stats
    WHERE category = ?
      AND date >= date('now', ? || ' days')
    GROUP BY keyword
    ORDER BY total DESC
    LIMIT ?
  `).all(category, `-${days}`, limit);
}

// 히트맵 그리드: top N 키워드 × 최근 N일 일별 count
function getHeatmapData({ category = 'all', days = 14, topN = 20 } = {}) {
  // top 키워드 먼저 추출
  const topKeywords = db.prepare(`
    SELECT keyword, SUM(count) as total
    FROM keyword_stats
    WHERE category = ?
      AND date >= date('now', ? || ' days')
    GROUP BY keyword
    ORDER BY total DESC
    LIMIT ?
  `).all(category, `-${days}`, topN).map(r => r.keyword);

  if (!topKeywords.length) return { keywords: [], dates: [], matrix: {} };

  // 날짜 목록 (최근 N일)
  const dates = db.prepare(`
    SELECT DISTINCT date
    FROM keyword_stats
    WHERE date >= date('now', ? || ' days')
    ORDER BY date ASC
  `).all(`-${days}`).map(r => r.date);

  // keyword × date count
  const placeholders = topKeywords.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT keyword, date, count
    FROM keyword_stats
    WHERE category = ?
      AND keyword IN (${placeholders})
      AND date >= date('now', ? || ' days')
  `).all(category, ...topKeywords, `-${days}`);

  const matrix = {};
  for (const kw of topKeywords) matrix[kw] = {};
  for (const row of rows) matrix[row.keyword][row.date] = row.count;

  return { keywords: topKeywords, dates, matrix };
}

// TOP 10 키워드 (기간별)
function getTopKeywords({ category = 'all', period = 'daily' } = {}) {
  const daysMap = { daily: 1, weekly: 7, monthly: 30 };
  const days = daysMap[period] || 1;

  return db.prepare(`
    SELECT keyword, SUM(count) as total
    FROM keyword_stats
    WHERE category = ?
      AND date >= date('now', ? || ' days')
    GROUP BY keyword
    ORDER BY total DESC
    LIMIT 10
  `).all(category, `-${days}`);
}

// 트렌드: 상위 키워드들의 일별 추이
function getTrendData({ category = 'all', days = 30, topN = 8 } = {}) {
  const topKeywords = db.prepare(`
    SELECT keyword
    FROM keyword_stats
    WHERE category = ?
      AND date >= date('now', ? || ' days')
    GROUP BY keyword
    ORDER BY SUM(count) DESC
    LIMIT ?
  `).all(category, `-${days}`, topN).map(r => r.keyword);

  if (!topKeywords.length) return { keywords: [], dates: [], series: {} };

  const dates = db.prepare(`
    SELECT DISTINCT date FROM keyword_stats
    WHERE date >= date('now', ? || ' days')
    ORDER BY date ASC
  `).all(`-${days}`).map(r => r.date);

  const placeholders = topKeywords.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT keyword, date, SUM(count) as count
    FROM keyword_stats
    WHERE category = ?
      AND keyword IN (${placeholders})
      AND date >= date('now', ? || ' days')
    GROUP BY keyword, date
  `).all(category, ...topKeywords, `-${days}`);

  const series = {};
  for (const kw of topKeywords) series[kw] = {};
  for (const row of rows) series[row.keyword][row.date] = row.count;

  return { keywords: topKeywords, dates, series };
}

// 기존 기사로 키워드 재계산 (초기화 용)
function getAllArticlesForKeywords() {
  return db.prepare(`
    SELECT title, description, category, pub_date
    FROM articles
    WHERE pub_date IS NOT NULL
  `).all();
}

function keywordStatsEmpty() {
  return db.prepare(`SELECT COUNT(*) as cnt FROM keyword_stats`).get().cnt === 0;
}

// ─── AI 분석 결과 저장/조회 ──────────────────────────

function createAnalysis(windowFrom, windowTo, articleCount) {
  const info = db.prepare(`
    INSERT INTO market_analysis (window_from, window_to, article_count, status)
    VALUES (?, ?, ?, 'pending')
  `).run(windowFrom, windowTo, articleCount);
  return info.lastInsertRowid;
}

function saveAnalysisResult(id, { geminiResult, groqResult }) {
  const agreement      = groqResult?.agreement || null;
  const agreementScore = groqResult?.agreementScore ?? null;
  db.prepare(`
    UPDATE market_analysis SET
      status = 'success',
      gemini_json = ?, groq_json = ?,
      agreement = ?, agreement_score = ?
    WHERE id = ?
  `).run(
    geminiResult ? JSON.stringify(geminiResult) : null,
    groqResult   ? JSON.stringify(groqResult)   : null,
    agreement, agreementScore,
    id
  );
}

function saveAnalysisError(id, error) {
  db.prepare(`
    UPDATE market_analysis SET status = 'error', error = ? WHERE id = ?
  `).run(error, id);
}

function getLatestAnalysis() {
  const row = db.prepare(`
    SELECT * FROM market_analysis
    WHERE status = 'success'
    ORDER BY id DESC LIMIT 1
  `).get();
  if (!row) return null;
  return {
    id:             row.id,
    analyzed_at:    row.analyzed_at,
    window_from:    row.window_from,
    window_to:      row.window_to,
    article_count:  row.article_count,
    agreement:      row.agreement,
    agreement_score: row.agreement_score,
    gemini: row.gemini_json ? JSON.parse(row.gemini_json) : null,
    groq:   row.groq_json   ? JSON.parse(row.groq_json)   : null,
  };
}

function getAnalysisStatus() {
  return db.prepare(`
    SELECT id, status, error, analyzed_at, model, article_count
    FROM market_analysis ORDER BY id DESC LIMIT 1
  `).get();
}

// 증시 시간창 기사 조회
function getMarketWindowArticles(fromISO, toISO) {
  return db.prepare(`
    SELECT title, description, category, pub_date, source_name
    FROM articles
    WHERE pub_date >= ? AND pub_date <= ?
    ORDER BY pub_date DESC
  `).all(fromISO, toISO);
}

// 증시 시간창 시간별 기사 수 (히스토그램용)
function getMarketHourlyCount(fromISO, toISO) {
  return db.prepare(`
    SELECT
      strftime('%Y-%m-%dT%H:00:00', pub_date) AS hour,
      COUNT(*) AS count,
      category
    FROM articles
    WHERE pub_date >= ? AND pub_date <= ?
    GROUP BY hour, category
    ORDER BY hour ASC
  `).all(fromISO, toISO);
}

module.exports = {
  startCrawl,
  finishCrawl,
  saveArticles,
  getArticles,
  getCategoryCounts,
  getCrawlLogs,
  getLastCrawlTime,
  cleanOldArticles,
  upsertKeywords,
  getWordCloud,
  getHeatmapData,
  getTopKeywords,
  getTrendData,
  getAllArticlesForKeywords,
  keywordStatsEmpty,
  getMarketWindowArticles,
  getMarketHourlyCount,
  createAnalysis,
  saveAnalysisResult,
  saveAnalysisError,
  getLatestAnalysis,
  getAnalysisStatus,
};
