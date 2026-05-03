const fs = require('fs');
const path = require('path');
const {
  getMarketDailySeries,
  getMarketWindowArticles,
  getStockSummary,
} = require('./db');

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const HARNESS_PATH = path.resolve(__dirname, '../../stock-analysis-harness.md');
const MAX_STOCK_ROWS_PER_MARKET = 35;
const MAX_NEWS_ROWS = 12;

function safeJson(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(match ? match[1].trim() : text.trim());
}

function loadStockAnalysisSystemPrompt() {
  const markdown = fs.readFileSync(HARNESS_PATH, 'utf8');
  const match = markdown.match(/## SYSTEM PROMPT[\s\S]*?```([\s\S]*?)```/);
  return (match ? match[1] : markdown).trim();
}

function fmtPct(ratio, digits = 3) {
  if (ratio == null || Number.isNaN(Number(ratio))) return 'n/a';
  const pct = Number(ratio) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(digits)}%`;
}

function fmtEok(value) {
  if (value == null || Number.isNaN(Number(value))) return '0억';
  const eok = Number(value) / 1e8;
  return `${eok >= 0 ? '+' : ''}${Math.round(eok).toLocaleString('ko-KR')}억`;
}

function fmtCap(value) {
  if (value == null || Number.isNaN(Number(value))) return '0.0조';
  return `${(Number(value) / 1e12).toFixed(1)}조`;
}

function fmtDate(date) {
  if (!date) return '';
  return date.length === 8 ? `${date.slice(4, 6)}-${date.slice(6, 8)}` : date.slice(5, 10);
}

function formatMarketSeries(market, rows) {
  if (!rows.length) return `${market}: 데이터 없음`;
  return [
    `${market} 일별 수급비율:`,
    ...rows.map(row => `${fmtDate(row.trade_date)}  ${fmtPct(row.ratio)}  ${fmtEok(row.sumNet)}`),
  ].join('\n');
}

function buildStockRows(rows, selectedTicker) {
  const selected = selectedTicker ? rows.find(row => row.ticker === selectedTicker) : null;
  const picked = rows.slice(0, MAX_STOCK_ROWS_PER_MARKET);
  if (selected && !picked.some(row => row.ticker === selected.ticker)) picked.push(selected);

  return picked.map((row, idx) => (
    `${idx + 1} | ${row.name}(${row.ticker}) | ${row.market} | ${fmtCap(row.latestCap)} | ${fmtPct(row.cumRatio)} | ${fmtEok(row.cumInstNet)} | ${fmtEok(row.cumForNet)} | ${fmtEok(row.cumFundNet)}`
  ));
}

function getRecentNewsRows() {
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  return getMarketWindowArticles(from.toISOString(), to.toISOString()).slice(0, MAX_NEWS_ROWS);
}

function buildNewsText(rows) {
  if (!rows.length) return '최근 24시간 관련 뉴스 없음';
  return rows.map((row, idx) => {
    const description = (row.description || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    const date = row.pub_date ? ` date=${String(row.pub_date).slice(0, 16)}` : '';
    const source = row.source_name ? ` source=${row.source_name}` : '';
    return `[${idx + 1}][${row.category || 'unknown'}${source}${date}]\nTITLE: ${row.title}\nDESC: ${description}`;
  }).join('\n\n');
}

function buildStockAnalysisPrompt({ prompt, market = 'KOSPI', ticker = null } = {}) {
  const kospiSeries = getMarketDailySeries('KOSPI');
  const kosdaqSeries = getMarketDailySeries('KOSDAQ');
  const kospiSummary = getStockSummary('KOSPI');
  const kosdaqSummary = getStockSummary('KOSDAQ');
  const newsRows = getRecentNewsRows();

  if (!kospiSummary.length && !kosdaqSummary.length) {
    throw new Error('주가 수급 데이터가 없습니다. 먼저 주가 데이터를 수집하세요.');
  }

  const latestDate = [kospiSeries.at(-1)?.trade_date, kosdaqSeries.at(-1)?.trade_date]
    .filter(Boolean)
    .sort()
    .at(-1) || new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const stockRows = [
    ...buildStockRows(kospiSummary, ticker),
    ...buildStockRows(kosdaqSummary, ticker),
  ];

  return {
    latestDate,
    articleCount: newsRows.length,
    stockRowCount: stockRows.length,
    text: `
=== 분석 요청 ===
기준일: ${latestDate}
분석 시장: KOSPI + KOSDAQ
현재 화면 시장: ${market}
현재 선택 종목: ${ticker || '없음'}

=== 사용자 추가 프롬프트 ===
${prompt}

=== 시장 전체 수급 시계열 (최근 14거래일) ===
${formatMarketSeries('KOSPI', kospiSeries)}

${formatMarketSeries('KOSDAQ', kosdaqSeries)}

=== 시총 TOP 종목 수급 요약 (14일 누적, Groq 무료 API 한도에 맞춘 압축 컨텍스트) ===
형식: 순위 | 종목명(코드) | 시장 | 시총(조원) | 14일누적수급비율 | 기관순매수(억원) | 외인순매수(억원) | 연기금순매수(억원)

${stockRows.join('\n')}

=== 관련 뉴스 (최근 24시간, 수급 해석 보조용) ===
${buildNewsText(newsRows)}

위 데이터를 기반으로 stock-analysis-harness.md의 출력 계약을 지키는 수급 분석 JSON을 반환하세요.
`.trim(),
  };
}

async function runStockAnalysis({ prompt, market, ticker }) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY 미설정');

  const normalizedPrompt = String(prompt || '').trim();
  if (!normalizedPrompt) throw new Error('분석 프롬프트를 입력하세요.');

  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const systemPrompt = loadStockAnalysisSystemPrompt();
  const userPrompt = buildStockAnalysisPrompt({
    prompt: normalizedPrompt,
    market: String(market || 'KOSPI').toUpperCase(),
    ticker: ticker ? String(ticker).trim() : null,
  });

  console.log(`[stockAnalysisAgent] Groq 수급 분석 시작 — ${userPrompt.latestDate}, rows=${userPrompt.stockRowCount}`);

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt.text },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 4096,
  });

  const raw = completion.choices[0].message.content;
  return {
    generatedAt: new Date().toISOString(),
    model: GROQ_MODEL,
    harness: path.basename(HARNESS_PATH),
    context: {
      market: String(market || 'KOSPI').toUpperCase(),
      ticker: ticker || null,
      latestDate: userPrompt.latestDate,
      articleCount: userPrompt.articleCount,
      stockRowCount: userPrompt.stockRowCount,
    },
    result: safeJson(raw),
  };
}

module.exports = {
  runStockAnalysis,
};
