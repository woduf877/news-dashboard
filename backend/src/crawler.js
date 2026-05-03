const Parser = require('rss-parser');
const { startCrawl, finishCrawl, saveArticles, cleanOldArticles } = require('./db');

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; NewsDashboard/1.0)',
  },
  customFields: {
    item: ['media:thumbnail', 'enclosure'],
  },
});

// 미국 증시 관련 뉴스 소스
const US_MARKET_SOURCES = [
  { name: 'CNBC US Markets',    url: 'https://www.cnbc.com/id/15839069/device/rss/rss.html',        category: 'us_market', lang: 'en' },
  { name: 'CNBC Economy',       url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html',        category: 'us_market', lang: 'en' },
  { name: 'Fortune',            url: 'https://fortune.com/feed/',                                   category: 'us_market', lang: 'en' },
  { name: 'NPR Business',       url: 'https://feeds.npr.org/1006/rss.xml',                          category: 'us_market', lang: 'en' },
  { name: 'Seeking Alpha',      url: 'https://seekingalpha.com/market_currents.xml',                category: 'us_market', lang: 'en' },
  { name: 'Benzinga',           url: 'https://www.benzinga.com/feed',                               category: 'us_market', lang: 'en' },
  { name: 'Investing.com US',   url: 'https://www.investing.com/rss/news_25.rss',                   category: 'us_market', lang: 'en' },
  { name: 'Yahoo Finance',      url: 'https://finance.yahoo.com/rss/topstories',                    category: 'us_market', lang: 'en' },
];

// 한국 증시 관련 뉴스 소스 (한국어 + 영어)
const KOREA_MARKET_SOURCES = [
  // 한국 경제·증시 (한국어)
  { name: '한국경제',          url: 'https://www.hankyung.com/feed/economy',                           category: 'korea_market', lang: 'ko' },
  { name: '매일경제',          url: 'https://www.mk.co.kr/rss/40300001/',                              category: 'korea_market', lang: 'ko' },
  { name: '뉴시스 경제',        url: 'https://www.newsis.com/RSS/economy.xml',                          category: 'korea_market', lang: 'ko' },
  { name: '뉴시스 금융',        url: 'https://www.newsis.com/RSS/bank.xml',                             category: 'korea_market', lang: 'ko' },
  { name: '뉴시스 산업',        url: 'https://www.newsis.com/RSS/industry.xml',                         category: 'korea_market', lang: 'ko' },
  // 영문 한국 경제
  { name: 'Korea Herald 경제', url: 'https://www.koreaherald.com/rss/business.xml',                   category: 'korea_market', lang: 'en' },
  // 글로벌 금융 (한국 증시 영향)
  { name: 'CNBC Finance',      url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html',           category: 'korea_market', lang: 'en' },
  { name: 'MarketWatch',       url: 'https://feeds.marketwatch.com/marketwatch/topstories/',          category: 'korea_market', lang: 'en' },
  { name: 'Investing.com 한국', url: 'https://kr.investing.com/rss/news_25.rss',                      category: 'korea_market', lang: 'ko' },
  { name: 'Yahoo Finance KOSPI', url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EKS11&region=US&lang=en-US', category: 'korea_market', lang: 'en' },
];

const MAX_ITEMS_PER_SOURCE = 20;

// RSS 피드 하나를 파싱해서 기사 배열 반환
async function fetchSource(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const items = (feed.items || []).slice(0, MAX_ITEMS_PER_SOURCE);

    return items.map((item) => ({
      guid:        item.guid || item.link || `${source.name}-${item.isoDate || item.pubDate || ''}-${item.title}`,
      title:       (item.title || '').trim(),
      description: stripHtml(item.contentSnippet || item.content || item.summary || ''),
      link:        item.link || '',
      pub_date:    item.isoDate || item.pubDate || new Date().toISOString(),
      source_name: source.name,
      category:    source.category,
      lang:        source.lang || 'en',
    })).filter(a => a.title);

  } catch (err) {
    console.warn(`[crawler] ${source.name} 실패: ${err.message}`);
    return [];
  }
}

// HTML 태그 제거
function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

// 전체 크롤 실행 (증시 AI 분석용 한국/미국 증시 뉴스 백데이터)
async function runCrawl() {
  console.log(`[crawler] 크롤 시작 — ${new Date().toLocaleString('ko-KR')}`);
  const crawlId = startCrawl();

  const allSources = [...KOREA_MARKET_SOURCES, ...US_MARKET_SOURCES];
  const results = [];
  for (let i = 0; i < allSources.length; i += 5) {
    const batch = allSources.slice(i, i + 5);
    const batchResults = await Promise.all(batch.map(fetchSource));
    results.push(...batchResults.flat());
  }

  let saved = 0;
  try {
    saved = saveArticles(results, crawlId);
    const deleted = cleanOldArticles();

    finishCrawl(crawlId, saved);
    console.log(`[crawler] 완료 — 신규 ${saved}건 저장, 오래된 기사 ${deleted}건 삭제`);
  } catch (err) {
    finishCrawl(crawlId, 0, err.message);
    console.error(`[crawler] DB 저장 오류:`, err);
  }

  return { crawlId, saved, total: results.length };
}

module.exports = { runCrawl, KOREA_MARKET_SOURCES, US_MARKET_SOURCES };
