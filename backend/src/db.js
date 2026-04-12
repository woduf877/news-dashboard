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

module.exports = {
  startCrawl,
  finishCrawl,
  saveArticles,
  getArticles,
  getCategoryCounts,
  getCrawlLogs,
  getLastCrawlTime,
  cleanOldArticles,
};
