const Parser = require('rss-parser');
const { startCrawl, finishCrawl, saveArticles, cleanOldArticles, upsertKeywords } = require('./db');
const { extractFromArticles } = require('./keywords');

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; NewsDashboard/1.0)',
  },
  customFields: {
    item: ['media:thumbnail', 'enclosure'],
  },
});

// 한국 증시 관련 뉴스 소스 (한국어 + 영어)
const KOREA_MARKET_SOURCES = [
  // 한국 경제·증시 (한국어)
  { name: '연합뉴스 경제',   url: 'https://www.yna.co.kr/economy/rss.xml',                           category: 'korea_market', lang: 'ko' },
  { name: '한국경제',        url: 'https://www.hankyung.com/feed/economy',                           category: 'korea_market', lang: 'ko' },
  { name: '매일경제',        url: 'https://www.mk.co.kr/rss/40300001/',                              category: 'korea_market', lang: 'ko' },
  { name: '조선비즈',        url: 'https://biz.chosun.com/site/data/rss/rss.xml',                   category: 'korea_market', lang: 'ko' },
  { name: '머니투데이',      url: 'https://news.mt.co.kr/mtview/mt_m_rss.php',                      category: 'korea_market', lang: 'ko' },
  { name: '이데일리',        url: 'https://www.edaily.co.kr/rss/feed.xml',                          category: 'korea_market', lang: 'ko' },
  // 영문 한국 경제
  { name: 'Korea Herald 경제', url: 'https://www.koreaherald.com/rss/business.xml',                 category: 'korea_market', lang: 'en' },
  { name: 'Korea Times 비즈',  url: 'https://www.koreatimes.co.kr/www/rss/rss_biz.xml',             category: 'korea_market', lang: 'en' },
  // 글로벌 금융 (한국 증시 영향)
  { name: 'CNBC Finance',    url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html',           category: 'korea_market', lang: 'en' },
  { name: 'MarketWatch',     url: 'https://feeds.marketwatch.com/marketwatch/topstories/',          category: 'korea_market', lang: 'en' },
];

// 뉴스 소스 목록 (카테고리별 RSS 피드)
const NEWS_SOURCES = [
  // 세계
  { name: 'BBC World',         url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                     category: 'world' },
  { name: 'Al Jazeera',        url: 'https://www.aljazeera.com/xml/rss/all.xml',                        category: 'world' },
  { name: 'NPR World',         url: 'https://feeds.npr.org/1004/rss.xml',                               category: 'world' },
  { name: 'The Guardian',      url: 'https://www.theguardian.com/world/rss',                            category: 'world' },
  { name: 'DW News',           url: 'https://rss.dw.com/rdf/rss-en-all',                                category: 'world' },

  // 기술
  { name: 'TechCrunch',        url: 'https://techcrunch.com/feed/',                                     category: 'technology' },
  { name: 'The Verge',         url: 'https://www.theverge.com/rss/index.xml',                           category: 'technology' },
  { name: 'Ars Technica',      url: 'https://feeds.arstechnica.com/arstechnica/index',                  category: 'technology' },
  { name: 'Wired',             url: 'https://www.wired.com/feed/rss',                                   category: 'technology' },
  { name: 'Hacker News',       url: 'https://hnrss.org/frontpage',                                      category: 'technology' },

  // 비즈니스
  { name: 'BBC Business',      url: 'https://feeds.bbci.co.uk/news/business/rss.xml',                   category: 'business' },
  { name: 'MarketWatch',       url: 'https://feeds.marketwatch.com/marketwatch/topstories/',            category: 'business' },
  { name: 'CNBC Top News',     url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',            category: 'business' },

  // 과학
  { name: 'BBC Science',       url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',   category: 'science' },
  { name: 'Science Daily',     url: 'https://www.sciencedaily.com/rss/all.xml',                         category: 'science' },
  { name: 'NASA News',         url: 'https://www.nasa.gov/news-release/feed/',                          category: 'science' },

  // 건강
  { name: 'BBC Health',        url: 'https://feeds.bbci.co.uk/news/health/rss.xml',                     category: 'health' },
  { name: 'Medical Xpress',    url: 'https://medicalxpress.com/rss-feed/',                              category: 'health' },

  // 스포츠
  { name: 'BBC Sport',         url: 'https://feeds.bbci.co.uk/sport/rss.xml',                           category: 'sports' },
  { name: 'ESPN',              url: 'https://www.espn.com/espn/rss/news',                               category: 'sports' },
];

const MAX_ITEMS_PER_SOURCE = 20;

// RSS 피드 하나를 파싱해서 기사 배열 반환
async function fetchSource(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const items = (feed.items || []).slice(0, MAX_ITEMS_PER_SOURCE);

    return items.map((item) => ({
      guid:        item.guid || item.link || `${source.name}-${item.title}`,
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

// 전체 크롤 실행 (일반 뉴스 + 한국 증시 소스 통합)
async function runCrawl() {
  console.log(`[crawler] 크롤 시작 — ${new Date().toLocaleString('ko-KR')}`);
  const crawlId = startCrawl();

  const allSources = [...NEWS_SOURCES, ...KOREA_MARKET_SOURCES];
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

    // 키워드 추출 및 저장
    const extracted = extractFromArticles(results);
    upsertKeywords(extracted);

    finishCrawl(crawlId, saved);
    console.log(`[crawler] 완료 — 신규 ${saved}건 저장, 오래된 기사 ${deleted}건 삭제`);
  } catch (err) {
    finishCrawl(crawlId, 0, err.message);
    console.error(`[crawler] DB 저장 오류:`, err);
  }

  return { crawlId, saved, total: results.length };
}

module.exports = { runCrawl, NEWS_SOURCES, KOREA_MARKET_SOURCES };
