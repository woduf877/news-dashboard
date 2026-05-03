const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'news.db'));
const STOCK_TARGET_COUNT = 150;
const STOCK_HISTORY_DAYS = 14;

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

  CREATE TABLE IF NOT EXISTS stock_daily (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker      TEXT NOT NULL,
    name        TEXT,
    market      TEXT,
    trade_date  TEXT NOT NULL,
    close       INTEGER DEFAULT 0,
    cap         INTEGER DEFAULT 0,
    inst_buy    INTEGER DEFAULT 0,
    inst_sell   INTEGER DEFAULT 0,
    for_buy     INTEGER DEFAULT 0,
    for_sell    INTEGER DEFAULT 0,
    fund_buy    INTEGER DEFAULT 0,
    fund_sell   INTEGER DEFAULT 0,
    investor_breakdown INTEGER DEFAULT 0,
    UNIQUE(ticker, trade_date)
  );

  CREATE INDEX IF NOT EXISTS idx_sd_date   ON stock_daily(trade_date DESC);
  CREATE INDEX IF NOT EXISTS idx_sd_ticker ON stock_daily(ticker);
  CREATE INDEX IF NOT EXISTS idx_sd_market ON stock_daily(market, trade_date DESC);

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
    agreement_score REAL,
    runs_json     TEXT,
    summary_json  TEXT
  );
`);

// 기존 DB에 컬럼이 없을 경우 마이그레이션
for (const col of ['runs_json', 'summary_json']) {
  try { db.exec(`ALTER TABLE market_analysis ADD COLUMN ${col} TEXT`); } catch {}
}

for (const [col, type] of [
  ['fund_buy', 'INTEGER DEFAULT 0'],
  ['fund_sell', 'INTEGER DEFAULT 0'],
  ['investor_breakdown', 'INTEGER DEFAULT 0'],
]) {
  try { db.exec(`ALTER TABLE stock_daily ADD COLUMN ${col} ${type}`); } catch {}
}

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

// ─── 주가 데이터 저장/조회 ───────────────────────────

function saveStockDays(rows) {
  const upsert = db.prepare(`
    INSERT INTO stock_daily
      (ticker, name, market, trade_date, close, cap,
       inst_buy, inst_sell, for_buy, for_sell, fund_buy, fund_sell, investor_breakdown)
    VALUES
      (@ticker, @name, @market, @trade_date, @close, @cap,
       @inst_buy, @inst_sell, @for_buy, @for_sell, @fund_buy, @fund_sell, @investor_breakdown)
    ON CONFLICT(ticker, trade_date) DO UPDATE SET
      close     = excluded.close,
      cap       = excluded.cap,
      inst_buy  = excluded.inst_buy,
      inst_sell = excluded.inst_sell,
      for_buy   = excluded.for_buy,
      for_sell  = excluded.for_sell,
      fund_buy  = excluded.fund_buy,
      fund_sell = excluded.fund_sell,
      investor_breakdown = excluded.investor_breakdown
  `);
  const run = db.transaction(items => {
    for (const r of items) {
      upsert.run({
        fund_buy: 0,
        fund_sell: 0,
        investor_breakdown: 0,
        ...r,
      });
    }
  });
  run(rows);
}

function cleanOldStockDays(keepDays = 14, market = null) {
  if (market) {
    const result = db.prepare(`
      DELETE FROM stock_daily
      WHERE market = ?
        AND trade_date NOT IN (
          SELECT trade_date FROM (
            SELECT DISTINCT trade_date
            FROM stock_daily
            WHERE market = ?
            ORDER BY trade_date DESC
            LIMIT ?
          )
        )
    `).run(market, market, keepDays);
    return result.changes;
  }

  const result = db.prepare(`
    DELETE FROM stock_daily
    WHERE trade_date NOT IN (
      SELECT trade_date FROM (
        SELECT DISTINCT trade_date
        FROM stock_daily
        ORDER BY trade_date DESC
        LIMIT ?
      )
    )
  `).run(keepDays);
  return result.changes;
}

function deleteStockDaysOutsideDates(market, dates) {
  if (!dates.length) return 0;
  const placeholders = dates.map(() => '?').join(',');
  const result = db.prepare(`
    DELETE FROM stock_daily
    WHERE market = ?
      AND trade_date NOT IN (${placeholders})
  `).run(market, ...dates);
  return result.changes;
}

// 시장별 최신 날짜 목록 조회 (날짜 내림차순)
function getStockDates(market) {
  return db.prepare(`
    SELECT DISTINCT trade_date
    FROM stock_daily
    WHERE market = ?
    ORDER BY trade_date DESC
    LIMIT 14
  `).all(market).map(r => r.trade_date);
}

// 날짜별 TOP 종목 적재 수 조회 (기존 날짜가 TOP 수량보다 부족한지 확인)
function getStockCoverageByDate(market, dates, tickers) {
  if (!dates.length || !tickers.length) return {};
  const datePlaceholders = dates.map(() => '?').join(',');
  const tickerPlaceholders = tickers.map(() => '?').join(',');

  const rows = db.prepare(`
    SELECT trade_date, COUNT(DISTINCT ticker) AS count
    FROM stock_daily
    WHERE market = ?
      AND trade_date IN (${datePlaceholders})
      AND ticker IN (${tickerPlaceholders})
      AND investor_breakdown = 1
    GROUP BY trade_date
  `).all(market, ...dates, ...tickers);

  return Object.fromEntries(rows.map(r => [r.trade_date, r.count]));
}

// 특정 날짜의 시총 TOP 종목 (+ 14일 누적 순매수 계산)
function getStockSummary(market) {
  // 최신 날짜
  const latestRow = db.prepare(`
    SELECT trade_date FROM stock_daily
    WHERE market = ? ORDER BY trade_date DESC LIMIT 1
  `).get(market);
  if (!latestRow) return [];

  const latest = latestRow.trade_date;

  // 최신일 기준 시총 TOP 종목 목록
  const topStocks = db.prepare(`
    SELECT ticker, name FROM stock_daily
    WHERE market = ? AND trade_date = ?
    ORDER BY cap DESC LIMIT ?
  `).all(market, latest, STOCK_TARGET_COUNT);

  if (!topStocks.length) return [];
  const tickers = topStocks.map(r => r.ticker);
  const placeholders = tickers.map(() => '?').join(',');
  const dateRows = db.prepare(`
    SELECT DISTINCT trade_date
    FROM stock_daily
    WHERE market = ?
    ORDER BY trade_date DESC
    LIMIT ?
  `).all(market, STOCK_HISTORY_DAYS).map(r => r.trade_date);
  const datePlaceholders = dateRows.map(() => '?').join(',');

  // 14일 누적 데이터
  const rows = db.prepare(`
    SELECT
      ticker,
      MAX(CASE WHEN trade_date = ? THEN cap   ELSE 0 END)  AS latest_cap,
      MAX(CASE WHEN trade_date = ? THEN close ELSE 0 END)  AS latest_close,
      SUM(inst_buy - inst_sell) AS cum_inst_net,
      SUM(for_buy  - for_sell)  AS cum_for_net,
      SUM(fund_buy - fund_sell) AS cum_fund_net,
      COUNT(DISTINCT trade_date)                            AS day_count
    FROM stock_daily
    WHERE market = ?
      AND ticker IN (${placeholders})
      AND trade_date IN (${datePlaceholders})
    GROUP BY ticker
  `).all(latest, latest, market, ...tickers, ...dateRows);

  // 최신일 종목명 조인
  const nameMap = Object.fromEntries(topStocks.map(r => [r.ticker, r.name]));

  return rows.map(r => ({
    ticker:       r.ticker,
    name:         nameMap[r.ticker] || r.ticker,
    market,
    latestCap:    r.latest_cap,
    latestClose:  r.latest_close,
    cumInstNet:   r.cum_inst_net,
    cumForNet:    r.cum_for_net,
    cumFundNet:   r.cum_fund_net,
    cumNet:       r.cum_inst_net + r.cum_for_net + r.cum_fund_net,
    cumRatio:     r.latest_cap > 0
                    ? (r.cum_inst_net + r.cum_for_net + r.cum_fund_net) / r.latest_cap
                    : 0,
    dayCount:     r.day_count,
  })).sort((a, b) => b.latestCap - a.latestCap);
}

// 특정 종목의 14일 일별 데이터
function getStockTimeSeries(ticker) {
  return db.prepare(`
    SELECT
      trade_date,
      close,
      cap,
      inst_buy - inst_sell AS inst_net,
      for_buy  - for_sell  AS for_net,
      fund_buy - fund_sell AS fund_net,
      CASE
        WHEN cap > 0 THEN CAST(inst_buy - inst_sell + for_buy - for_sell + fund_buy - fund_sell AS REAL) / cap
        ELSE 0
      END AS ratio
    FROM stock_daily
    WHERE ticker = ?
    ORDER BY trade_date ASC
  `).all(ticker);
}

// 시장별 stock_daily 원천 데이터 다운로드용
function getStockRawRows(market) {
  return db.prepare(`
    SELECT
      market,
      trade_date,
      ticker,
      name,
      close,
      cap,
      inst_buy,
      inst_sell,
      inst_buy - inst_sell AS inst_net,
      for_buy,
      for_sell,
      for_buy - for_sell AS for_net,
      fund_buy,
      fund_sell,
      fund_buy - fund_sell AS fund_net,
      inst_buy - inst_sell + for_buy - for_sell + fund_buy - fund_sell AS total_net,
      investor_breakdown
    FROM stock_daily
    WHERE market = ?
    ORDER BY trade_date DESC, cap DESC, ticker ASC
  `).all(market);
}

// 시장 전체 일별 집계 (TOP 종목 합산)
function getMarketDailySeries(market) {
  const topStocks = db.prepare(`
    SELECT ticker FROM stock_daily
    WHERE market = ? AND trade_date = (
      SELECT MAX(trade_date) FROM stock_daily WHERE market = ?
    )
    ORDER BY cap DESC LIMIT ?
  `).all(market, market, STOCK_TARGET_COUNT).map(r => r.ticker);

  if (!topStocks.length) return [];
  const ph = topStocks.map(() => '?').join(',');

  return db.prepare(`
    SELECT
      trade_date,
      SUM(inst_buy - inst_sell) AS inst_net,
      SUM(for_buy - for_sell) AS for_net,
      SUM(fund_buy - fund_sell) AS fund_net,
      SUM(inst_buy - inst_sell + for_buy - for_sell + fund_buy - fund_sell) AS sum_net,
      SUM(cap) AS sum_cap
    FROM stock_daily
    WHERE market = ? AND ticker IN (${ph})
    GROUP BY trade_date
    ORDER BY trade_date ASC
  `).all(market, ...topStocks).map(r => ({
    trade_date: r.trade_date,
    instNet:    r.inst_net,
    forNet:     r.for_net,
    fundNet:    r.fund_net,
    sumNet:     r.sum_net,
    sumCap:     r.sum_cap,
    ratio:      r.sum_cap > 0 ? r.sum_net / r.sum_cap : 0,
  }));
}

// ─── AI 분석 결과 저장/조회 ──────────────────────────

function createAnalysis(windowFrom, windowTo, articleCount) {
  const info = db.prepare(`
    INSERT INTO market_analysis (window_from, window_to, article_count, status)
    VALUES (?, ?, ?, 'pending')
  `).run(windowFrom, windowTo, articleCount);
  return info.lastInsertRowid;
}

function saveAnalysisResult(id, { geminiResult, groqResult, runs, summary }) {
  // agreement: 종합 일치도를 기존 필드에 매핑
  const consistencyMap = { high: 'agree', medium: 'partial', low: 'disagree' };
  const scoreMap       = { high: 1.0, medium: 0.67, low: 0.33 };
  const agreement      = summary?.consistency
    ? consistencyMap[summary.consistency]
    : (groqResult?.agreement || null);
  const agreementScore = summary?.consistency
    ? scoreMap[summary.consistency]
    : (groqResult?.agreementScore ?? null);

  db.prepare(`
    UPDATE market_analysis SET
      status = 'success',
      gemini_json = ?, groq_json = ?,
      agreement = ?, agreement_score = ?,
      runs_json = ?, summary_json = ?
    WHERE id = ?
  `).run(
    geminiResult ? JSON.stringify(geminiResult) : null,
    groqResult   ? JSON.stringify(groqResult)   : null,
    agreement, agreementScore,
    runs    ? JSON.stringify(runs)    : null,
    summary ? JSON.stringify(summary) : null,
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
    id:              row.id,
    analyzed_at:     row.analyzed_at,
    window_from:     row.window_from,
    window_to:       row.window_to,
    article_count:   row.article_count,
    agreement:       row.agreement,
    agreement_score: row.agreement_score,
    gemini:   row.gemini_json   ? JSON.parse(row.gemini_json)   : null,
    groq:     row.groq_json     ? JSON.parse(row.groq_json)     : null,
    runs:     row.runs_json     ? JSON.parse(row.runs_json)     : null,
    summary:  row.summary_json  ? JSON.parse(row.summary_json)  : null,
  };
}

function getAnalysisStatus() {
  return db.prepare(`
    SELECT id, status, error, analyzed_at, article_count
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
  getCrawlLogs,
  getLastCrawlTime,
  cleanOldArticles,
  saveStockDays,
  cleanOldStockDays,
  deleteStockDaysOutsideDates,
  getStockDates,
  getStockCoverageByDate,
  getStockSummary,
  getStockTimeSeries,
  getStockRawRows,
  getMarketDailySeries,
  getMarketWindowArticles,
  getMarketHourlyCount,
  createAnalysis,
  saveAnalysisResult,
  saveAnalysisError,
  getLatestAnalysis,
  getAnalysisStatus,
};
