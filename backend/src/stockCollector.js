/**
 * 한국투자증권 Open API 주가 데이터 수집기
 *
 * 수집 흐름:
 *  1. KIS MST 파일 다운로드 → 일반주(ST) 전체 티커 추출
 *  2. inquire-price 배치 호출 → 시가총액(hts_avls) 기준 TOP 100 선정
 *  3. 최근 14거래일 중 DB에 없는 날짜만 일별 종가·투자자 수급 수집
 *  4. SQLite stock_daily 저장 (최근 14거래일 롤링)
 *
 * API: https://apiportal.koreainvestment.com/
 */

const axios  = require('axios');
const AdmZip = require('adm-zip');
const fs     = require('fs');
const path   = require('path');
const {
  saveStockDays,
  cleanOldStockDays,
  deleteStockDaysOutsideDates,
  getStockDates,
} = require('./db');

const KIS_BASE   = 'https://openapi.koreainvestment.com:9443';
const APP_KEY    = process.env.KIS_APP_KEY;
const APP_SECRET = process.env.KIS_APP_SECRET;

const MST_URLS = {
  KOSPI:  'https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip',
  KOSDAQ: 'https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip',
};

const HISTORY_DAYS = 14;
const collectionStatus = {
  running: false,
  startedAt: null,
  finishedAt: null,
  lastResult: null,
  lastError: null,
};

// ─── 토큰 관리 (파일 + 메모리 캐시, 24시간) ─────────────
// 서버 재시작 시에도 토큰 재사용 → KIS 재발급 횟수 최소화

const TOKEN_FILE = path.join(__dirname, '../data/kis_token.json');
let _tokenCache = null;

async function getToken() {
  // 1. 메모리 캐시
  if (_tokenCache && _tokenCache.expiresAt > Date.now()) return _tokenCache.token;

  // 2. 파일 캐시
  try {
    const saved = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    if (saved.expiresAt > Date.now()) {
      _tokenCache = saved;
      console.log('[kis] 파일 캐시에서 토큰 로드');
      return _tokenCache.token;
    }
  } catch {}

  // 3. 새 토큰 발급
  const { data } = await axios.post(
    `${KIS_BASE}/oauth2/tokenP`,
    { grant_type: 'client_credentials', appkey: APP_KEY, appsecret: APP_SECRET },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15_000 }
  );

  if (!data.access_token) throw new Error(`KIS 토큰 발급 실패: ${JSON.stringify(data)}`);

  _tokenCache = {
    token:     data.access_token,
    expiresAt: Date.now() + ((data.expires_in || 86400) - 300) * 1000,
  };

  try { fs.writeFileSync(TOKEN_FILE, JSON.stringify(_tokenCache)); } catch {}
  console.log('[kis] 새 토큰 발급 및 파일 저장 완료');
  return _tokenCache.token;
}

// ─── 공통 헬퍼 ───────────────────────────────────────────

function kisHeaders(token, trId) {
  return {
    'content-type': 'application/json; charset=utf-8',
    authorization:  `Bearer ${token}`,
    appkey:         APP_KEY,
    appsecret:      APP_SECRET,
    tr_id:          trId,
    custtype:       'P',
  };
}

function toNum(v) {
  if (v == null) return 0;
  return Number(String(v).replace(/,/g, '')) || 0;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return ymd(d);
}

// ─── 수집 기준일 ─────────────────────────────────────────

const KRX_HOLIDAYS = new Set([
  '0101','0301','0505','0606','0815','1003','1009','1225',
]);

function isHoliday(kst) {
  const mmdd = String(kst.getUTCMonth() + 1).padStart(2, '0') +
               String(kst.getUTCDate()).padStart(2, '0');
  return KRX_HOLIDAYS.has(mmdd);
}

function getCollectionDate() {
  const now  = new Date();
  const kst  = new Date(now.getTime() + 9 * 3_600_000);
  const hour = kst.getUTCHours();
  const min  = kst.getUTCMinutes();

  if (hour < 18 || (hour === 18 && min < 30)) kst.setUTCDate(kst.getUTCDate() - 1);
  while ([0, 6].includes(kst.getUTCDay()) || isHoliday(kst)) kst.setUTCDate(kst.getUTCDate() - 1);

  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// ─── 1단계: MST → 일반주(ST) 티커 목록 ──────────────────
// 레코드 구조: [0-5] 단축코드 | [9-20] ISIN | [21-60] 한글명(EUC-KR) | [61-62] 그룹코드

const _mstDecoder = new TextDecoder('euc-kr', { fatal: false });

async function downloadStockTickers(market) {
  const { data } = await axios.get(MST_URLS[market], {
    responseType: 'arraybuffer', timeout: 30_000,
  });

  const zip    = new AdmZip(Buffer.from(data));
  const mst    = zip.getEntries()[0].getData();
  const stocks = []; // [{ ticker, name }]

  let pos = 0;
  while (pos < mst.length) {
    const end = mst.indexOf(0x0a, pos);
    if (end < 0) break;
    const ln = mst.slice(pos, end);

    const ticker = ln.slice(0, 6).toString('ascii');
    if (/^\d{6}$/.test(ticker) && ln.length > 63) {
      const groupCode = ln.slice(61, 63).toString('ascii');
      if (groupCode === 'ST') {
        // 종목명: bytes 21-60 (40바이트, EUC-KR)
        const name = _mstDecoder.decode(ln.slice(21, 61)).trim();
        stocks.push({ ticker, name });
      }
    }
    pos = end + 1;
  }

  console.log(`[kis] ${market} MST 티커 수: ${stocks.length}개`);
  return stocks; // [{ ticker, name }]
}

// ─── 2단계: 전체 시가총액 조회 → TOP 100 선정 ────────────
// tr_id: FHKST01010100 — 주식현재가 시세
// hts_avls: 시가총액 (억원)  stck_prpr: 현재가 (원)

async function fetchPrice(ticker, token) {
  const { data } = await axios.get(
    `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price`,
    {
      headers: kisHeaders(token, 'FHKST01010100'),
      params:  { fid_cond_mrkt_div_code: 'J', fid_input_iscd: ticker },
      timeout: 10_000,
    }
  );
  if (data.rt_cd !== '0') throw new Error(data.msg1);
  const o = data.output;
  return {
    ticker,
    close: toNum(o.stck_prpr),
    cap:   toNum(o.hts_avls) * 100_000_000, // 억원 → 원
  };
}

// stocks: [{ ticker, name }] from downloadStockTickers
async function fetchTop100ByPrice(stocks, market, token, batchSize = 5, delayMs = 500) {
  const results = [];
  const failed  = [];

  for (let i = 0; i < stocks.length; i += batchSize) {
    const batch = stocks.slice(i, i + batchSize);
    const rows = await Promise.all(
      batch.map(async ({ ticker, name }) => {
        try {
          const p = await fetchPrice(ticker, token);
          return { ...p, name };
        } catch (e) {
          failed.push({ ticker, name });
          return null;
        }
      })
    );
    results.push(...rows.filter(Boolean));
    if (i + batchSize < stocks.length && i % 100 === 0) {
      process.stdout.write(`\r[kis] ${market} 가격 조회: ${Math.min(i + batchSize, stocks.length)}/${stocks.length} (실패: ${failed.length})`);
    }
    if (i + batchSize < stocks.length) await new Promise(r => setTimeout(r, delayMs));
  }
  process.stdout.write('\n');

  // 실패 종목 1회 재시도 (2초 대기 후)
  if (failed.length) {
    console.log(`[kis] ${market} 실패 종목 재시도: ${failed.length}개`);
    await new Promise(r => setTimeout(r, 2000));
    for (const s of failed) {
      try {
        const p = await fetchPrice(s.ticker, token);
        results.push({ ...p, name: s.name });
      } catch {}
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return results
    .filter(r => r.cap > 0)
    .sort((a, b) => b.cap - a.cap)
    .slice(0, 100)
    .map(r => ({ ...r, market }));
}

// ─── 3단계: 일별 데이터 수집 ───────────────────────────
// tr_id: FHKST01010900 — 주식현재가 투자자
// orgn_ntby_tr_pbmn: 기관 순매수 거래대금 (원, 양수=순매수)
// frgn_ntby_tr_pbmn: 외국인 순매수 거래대금 (원, 양수=순매수)

async function fetchDailyPrices(ticker, token, fromDate, toDate) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data } = await axios.get(
        `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`,
        {
          headers: kisHeaders(token, 'FHKST03010100'),
          params: {
            fid_cond_mrkt_div_code: 'J',
            fid_input_iscd:        ticker,
            fid_input_date_1:      fromDate,
            fid_input_date_2:      toDate,
            fid_period_div_code:   'D',
            fid_org_adj_prc:       '0',
          },
          timeout: 10_000,
        }
      );
      if (data.rt_cd !== '0') throw new Error(data.msg1);

      return Object.fromEntries((data.output2 || []).map(row => [
        row.stck_bsop_date,
        { close: toNum(row.stck_clpr) },
      ]));
    } catch (e) {
      lastError = e;
      if (attempt < 3) await sleep(attempt * 1000);
    }
  }

  throw lastError;
}

async function fetchInvestorHistory(ticker, token) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data } = await axios.get(
        `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-investor`,
        {
          headers: kisHeaders(token, 'FHKST01010900'),
          params:  { fid_cond_mrkt_div_code: 'J', fid_input_iscd: ticker },
          timeout: 10_000,
        }
      );
      if (data.rt_cd !== '0') throw new Error(data.msg1);

      return Object.fromEntries((data.output || []).map(row => {
        // orgn_ntby_tr_pbmn / frgn_ntby_tr_pbmn 단위: 백만원 → 원 변환
        const instNet = toNum(row.orgn_ntby_tr_pbmn) * 1_000_000;
        const forNet  = toNum(row.frgn_ntby_tr_pbmn) * 1_000_000;
        return [row.stck_bsop_date, {
          instBuy:  Math.max(0,  instNet),
          instSell: Math.max(0, -instNet),
          forBuy:   Math.max(0,  forNet),
          forSell:  Math.max(0, -forNet),
        }];
      }));
    } catch (e) {
      lastError = e;
      if (attempt < 3) await sleep(attempt * 1000);
    }
  }

  throw lastError;
}

async function getRecentTradingDates(ticker, token) {
  const prices = await fetchDailyPrices(ticker, token, daysAgo(40), getCollectionDate());
  return Object.keys(prices).sort().reverse().slice(0, HISTORY_DAYS);
}

async function enrichMissingHistory(top100, market, token, missingDates, batchSize = 3, delayMs = 700) {
  const results = [];
  const wanted = new Set(missingDates);
  const fromDate = missingDates[missingDates.length - 1];
  const toDate   = missingDates[0];

  for (let i = 0; i < top100.length; i += batchSize) {
    const batch = top100.slice(i, i + batchSize);
    const rows = await Promise.all(
      batch.map(async s => {
        try {
          const [prices, investors] = await Promise.all([
            fetchDailyPrices(s.ticker, token, fromDate, toDate),
            fetchInvestorHistory(s.ticker, token),
          ]);
          const shares = s.close > 0 ? s.cap / s.close : 0;

          return missingDates
            .filter(date => wanted.has(date) && prices[date])
            .map(date => {
              const inv = investors[date] || {};
              const close = prices[date].close;
              return {
                ticker:     s.ticker,
                name:       s.name || s.ticker,
                market,
                trade_date: date,
                close,
                cap:        Math.round(close * shares),
                inst_buy:   inv.instBuy  || 0,
                inst_sell:  inv.instSell || 0,
                for_buy:    inv.forBuy   || 0,
                for_sell:   inv.forSell  || 0,
              };
            });
        } catch (e) {
          console.warn(`[kis] ${s.ticker} 일별 데이터 실패: ${e.message}`);
          return [];
        }
      })
    );
    results.push(...rows.flat());
    if (i + batchSize < top100.length) await sleep(delayMs);
  }
  return results;
}

// ─── 메인 수집 함수 ──────────────────────────────────────

function getStockCollectionStatus() {
  return { ...collectionStatus };
}

async function collectStockData() {
  if (collectionStatus.running) {
    console.log('[kis] 이미 주가 수집 실행 중 — 중복 요청 무시');
    return { skipped: true, reason: 'already_running', status: getStockCollectionStatus() };
  }

  collectionStatus.running = true;
  collectionStatus.startedAt = new Date().toISOString();
  collectionStatus.finishedAt = null;
  collectionStatus.lastError = null;

  try {
    const result = await collectStockDataInternal();
    collectionStatus.lastResult = result;
    return result;
  } catch (e) {
    collectionStatus.lastError = e.message;
    throw e;
  } finally {
    collectionStatus.running = false;
    collectionStatus.finishedAt = new Date().toISOString();
  }
}

async function collectStockDataInternal() {
  if (!APP_KEY || !APP_SECRET) {
    throw new Error('KIS_APP_KEY 또는 KIS_APP_SECRET이 backend/.env에 설정되지 않았습니다');
  }

  const trdDd = getCollectionDate();
  console.log(`[kis] 수집 시작 — 기준일: ${trdDd}, 최근 ${HISTORY_DAYS}거래일 백필`);

  const token   = await getToken();
  const summary = { date: trdDd, kospi: 0, kosdaq: 0, errors: [] };

  for (const market of ['KOSPI', 'KOSDAQ']) {
    try {
      // 1. MST에서 일반주 티커 목록 다운로드
      const tickers = await downloadStockTickers(market);

      // 2. 전체 시가총액 조회 → TOP 100 선정
      console.log(`[kis] ${market} 시가총액 조회 시작 (${tickers.length}종목)…`);
      const top100 = await fetchTop100ByPrice(tickers, market, token);
      if (!top100.length) throw new Error('TOP100 종목을 찾지 못했습니다');
      console.log(`[kis] ${market} TOP100 선정 완료 — 1위 시총: ${(top100[0]?.cap / 1e12).toFixed(1)}조원`);

      // 3. 최근 14거래일 중 DB에 없는 날짜만 수집
      const tradingDates = await getRecentTradingDates(top100[0].ticker, token);
      const pruned = deleteStockDaysOutsideDates(market, tradingDates);
      if (pruned) console.log(`[kis] ${market} 최근 거래일 밖 데이터 ${pruned}건 삭제`);

      const existingDates = new Set(getStockDates(market));
      const missingDates = tradingDates.filter(date => !existingDates.has(date));

      if (!missingDates.length) {
        console.log(`[kis] ${market} 최근 ${HISTORY_DAYS}거래일 데이터 이미 적재됨`);
        continue;
      }

      console.log(`[kis] ${market} 누락 거래일 ${missingDates.length}개 수집: ${missingDates.join(', ')}`);
      const rows = await enrichMissingHistory(top100, market, token, missingDates);
      saveStockDays(rows);
      summary[market.toLowerCase()] = rows.length;
      console.log(`[kis] ${market} 저장 완료 — ${rows.length}건`);

    } catch (e) {
      summary.errors.push(`${market}: ${e.message}`);
      collectionStatus.lastError = e.message;
      console.error(`[kis] ${market} 오류:`, e.message);
    }
  }

  const deleted = cleanOldStockDays(14);
  console.log(`[kis] 완료 — KOSPI ${summary.kospi}, KOSDAQ ${summary.kosdaq}, 삭제 ${deleted}건`);
  return summary;
}

// ─── 진단 함수 ───────────────────────────────────────────

async function kisDiagnose() {
  if (!APP_KEY || !APP_SECRET) return { error: 'KIS 키 미설정' };

  const result = { tokenOk: false, collectionDate: getCollectionDate() };

  try { await getToken(); result.tokenOk = true; }
  catch (e) { return { ...result, step: 'token', error: e.message }; }

  const token = _tokenCache.token;

  try {
    const { data } = await axios.get(
      `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price`,
      { headers: kisHeaders(token, 'FHKST01010100'),
        params:  { fid_cond_mrkt_div_code: 'J', fid_input_iscd: '005930' },
        timeout: 10_000 }
    );
    result.samsungPrice   = data.output?.stck_prpr;
    result.samsungCap억원 = data.output?.hts_avls;
  } catch (e) { return { ...result, step: 'inquire-price', error: e.message }; }

  try {
    const { data } = await axios.get(
      `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-investor`,
      { headers: kisHeaders(token, 'FHKST01010900'),
        params:  { fid_cond_mrkt_div_code: 'J', fid_input_iscd: '005930' },
        timeout: 10_000 }
    );
    const row = (data.output || [])[0] || {};
    result.instNetAmt = row.orgn_ntby_tr_pbmn;
    result.frgnNetAmt = row.frgn_ntby_tr_pbmn;
  } catch (e) { return { ...result, step: 'inquire-investor', error: e.message }; }

  try {
    const stocks = await downloadStockTickers('KOSPI');
    const samsung = stocks.find(s => s.ticker === '005930');
    result.samsungName    = samsung?.name;
    result.kospiStockCount = stocks.length;
  } catch (e) { return { ...result, step: 'mst-download', error: e.message }; }

  return result;
}

module.exports = {
  collectStockData,
  getCollectionDate,
  getStockCollectionStatus,
  kisDiagnose,
};
