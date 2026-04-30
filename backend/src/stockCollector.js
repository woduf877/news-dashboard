/**
 * KRX 주가 데이터 수집기
 *
 * 수집 내용:
 *  - 코스피 / 코스닥 시가총액 TOP 100 (각각)
 *  - 매일 NXT 종료(18:30 KST) 이후 실행
 *  - 수집 항목: 종가, 시가총액, 기관 순매수 금액, 외인 순매수 금액
 *  - SQLite stock_daily 테이블에 저장 (14일 FIFO 롤링)
 *
 * KRX 정보데이터시스템 API (비공개 내부 API, 인증 불필요)
 *  - 시가총액 목록: bld=MDCSTAT01501
 *  - 투자자별 거래실적: bld=MDCSTAT02303
 */

const axios = require('axios');
const { saveStockDays, cleanOldStockDays } = require('./db');

const KRX_URL     = 'https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd';
const KRX_HEADERS = {
  Referer:        'https://data.krx.co.kr/',
  'User-Agent':   'Mozilla/5.0 (compatible; NewsDashboard/1.0)',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  Accept:         'application/json, text/javascript, */*',
};

// ─── 수집 기준일 ─────────────────────────────────────────
// NXT 종료 18:30 KST 이전이면 전(영업)일 데이터를 대상으로 함

function getCollectionDate() {
  const now    = new Date();
  const kst    = new Date(now.getTime() + 9 * 3_600_000);
  const hour   = kst.getUTCHours();
  const minute = kst.getUTCMinutes();

  // 18:30 이전이면 하루 전으로
  if (hour < 18 || (hour === 18 && minute < 30)) {
    kst.setUTCDate(kst.getUTCDate() - 1);
  }
  // 주말이면 직전 금요일로
  while ([0, 6].includes(kst.getUTCDay())) {
    kst.setUTCDate(kst.getUTCDate() - 1);
  }

  const y  = kst.getUTCFullYear();
  const m  = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d  = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;  // YYYYMMDD
}

// ─── KRX API 호출 헬퍼 ───────────────────────────────────

async function krxPost(params) {
  const { data } = await axios.post(
    KRX_URL,
    new URLSearchParams(params).toString(),
    { headers: KRX_HEADERS, timeout: 20_000 }
  );
  return data;
}

function toNum(v) {
  if (v == null) return 0;
  return Number(String(v).replace(/,/g, '')) || 0;
}

// ─── 1단계: 시가총액 TOP 100 조회 ────────────────────────
// MDCSTAT01501: 전체 종목 시가총액 현황
// 반환 필드: ISU_SRT_CD(6자리코드), ISU_CD(ISIN), ISU_ABBRV(종목명),
//            MKTCAP(시가총액), TDD_CLSPRC(종가)

async function fetchTop100ByMarketCap(market, trdDd) {
  const mktId = market === 'KOSPI' ? 'STK' : 'KSQ';

  const data = await krxPost({
    bld:          'MDCSTAT01501',
    mktId,
    trdDd,
    share:        '1',
    money:        '1',
    csvxls_isNo:  'false',
  });

  const rows = data.OutBlock_1 || data.output || [];
  if (!rows.length) throw new Error(`${market} 시가총액 데이터 없음 (날짜: ${trdDd})`);

  return rows
    .filter(r => r.ISU_SRT_CD && r.MKTCAP)
    .sort((a, b) => toNum(b.MKTCAP) - toNum(a.MKTCAP))
    .slice(0, 100)
    .map(r => ({
      ticker:  r.ISU_SRT_CD,          // 6자리 종목코드
      isinCd:  r.ISU_CD || '',        // ISIN (투자자 데이터 조회용)
      name:    r.ISU_ABBRV || r.ISU_NM || r.ISU_SRT_CD,
      market,
      cap:     toNum(r.MKTCAP),       // 원(KRW)
      close:   toNum(r.TDD_CLSPRC),   // 원(KRW)
    }));
}

// ─── 2단계: 투자자별 거래실적 조회 ───────────────────────
// MDCSTAT02303: 개별종목 투자자별 거래실적 (종목코드 지정)
//
// 반환 필드 (KRX 내부 명칭 — 실제 응답에서 확인 후 조정 필요):
//   TRDVAL3  기관합계 매수금액   TRDVAL4  기관합계 매도금액
//   TRDVAL7  외국인   매수금액   TRDVAL8  외국인   매도금액
//
// 또는 명칭이 다를 경우 아래 fallback 필드명도 시도:
//   INST_BUY_TRDVAL / INST_SELL_TRDVAL
//   FORN_BUY_TRDVAL / FORN_SELL_TRDVAL

async function fetchInvestorDataForStock(isinCd, trdDd) {
  const data = await krxPost({
    bld:         'MDCSTAT02303',
    isuCd:       isinCd,
    trdDd,
    csvxls_isNo: 'false',
  });

  // KRX 응답은 OutBlock_1 배열의 첫 번째 항목 또는 단일 객체
  const row = (data.OutBlock_1 || [])[0] || data.output?.[0] || {};

  // 기관합계 (금융투자 + 보험 + 투자신탁 + 기타기관 합산)
  const instBuy  = toNum(row.TRDVAL3)  || toNum(row.INST_BUY_TRDVAL)  || 0;
  const instSell = toNum(row.TRDVAL4)  || toNum(row.INST_SELL_TRDVAL) || 0;

  // 외국인
  const forBuy   = toNum(row.TRDVAL7)  || toNum(row.FORN_BUY_TRDVAL)  || 0;
  const forSell  = toNum(row.TRDVAL8)  || toNum(row.FORN_SELL_TRDVAL) || 0;

  return { instBuy, instSell, forBuy, forSell };
}

// ─── 배치 처리 (rate-limit 방지) ─────────────────────────

async function fetchInBatches(stocks, trdDd, batchSize = 5, delayMs = 800) {
  const results = [];
  for (let i = 0; i < stocks.length; i += batchSize) {
    const batch = stocks.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async s => {
        try {
          const inv = await fetchInvestorDataForStock(s.isinCd, trdDd);
          return { ...s, ...inv };
        } catch (e) {
          console.warn(`[stockCollector] ${s.ticker}(${s.name}) 투자자 데이터 실패: ${e.message}`);
          return { ...s, instBuy: 0, instSell: 0, forBuy: 0, forSell: 0 };
        }
      })
    );
    results.push(...batchResults);
    if (i + batchSize < stocks.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return results;
}

// ─── 메인 수집 함수 ──────────────────────────────────────

async function collectStockData() {
  const trdDd = getCollectionDate();
  console.log(`[stockCollector] 수집 시작 — 기준일: ${trdDd}`);

  const summary = { date: trdDd, kospi: 0, kosdaq: 0, errors: [] };

  for (const market of ['KOSPI', 'KOSDAQ']) {
    try {
      // 1. 시총 TOP 100
      console.log(`[stockCollector] ${market} 시총 TOP100 조회 중…`);
      const top100 = await fetchTop100ByMarketCap(market, trdDd);
      console.log(`[stockCollector] ${market} TOP100: ${top100.length}개`);

      // 2. 투자자별 거래실적 (배치)
      console.log(`[stockCollector] ${market} 투자자 데이터 수집 중…`);
      const enriched = await fetchInBatches(top100, trdDd);

      // 3. DB 저장
      const rows = enriched.map(s => ({
        ticker:     s.ticker,
        name:       s.name,
        market:     s.market,
        trade_date: trdDd,
        close:      s.close,
        cap:        s.cap,
        inst_buy:   s.instBuy,
        inst_sell:  s.instSell,
        for_buy:    s.forBuy,
        for_sell:   s.forSell,
      }));
      saveStockDays(rows);
      summary[market.toLowerCase()] = rows.length;
      console.log(`[stockCollector] ${market} 저장 완료 — ${rows.length}건`);

    } catch (e) {
      summary.errors.push(`${market}: ${e.message}`);
      console.error(`[stockCollector] ${market} 오류:`, e.message);
    }
  }

  // 4. 14일 초과 데이터 FIFO 삭제
  const deleted = cleanOldStockDays(14);
  console.log(`[stockCollector] 완료 — KOSPI ${summary.kospi}, KOSDAQ ${summary.kosdaq}, 삭제 ${deleted}건`);
  return summary;
}

// ─── 진단 함수 (KRX API 필드명 확인용) ──────────────────────

async function krxDiagnose(trdDd) {
  // 1. 시총 API 응답 구조 확인 (상위 3개 종목만)
  const capData = await krxPost({
    bld: 'MDCSTAT01501', mktId: 'STK', trdDd,
    share: '1', money: '1', csvxls_isNo: 'false',
  });
  const capRows = (capData.OutBlock_1 || capData.output || []).slice(0, 3);

  if (!capRows.length) {
    return { capFields: [], capSample: [], invFields: [], invSample: {} };
  }

  // 2. 투자자 API 응답 구조 확인 (첫 번째 종목만)
  const firstIsin = capRows[0]?.ISU_CD || capRows[0]?.ISU_SRT_CD || '';
  let invData = {};
  if (firstIsin) {
    const raw = await krxPost({
      bld: 'MDCSTAT02303', isuCd: firstIsin, trdDd, csvxls_isNo: 'false',
    });
    invData = (raw.OutBlock_1 || [])[0] || raw.output?.[0] || {};
  }

  return {
    capFields:  capRows.length ? Object.keys(capRows[0]) : [],
    capSample:  capRows.map(r => ({ ISU_SRT_CD: r.ISU_SRT_CD, ISU_CD: r.ISU_CD, ISU_ABBRV: r.ISU_ABBRV, MKTCAP: r.MKTCAP })),
    invFields:  Object.keys(invData),
    invSample:  invData,
  };
}

module.exports = { collectStockData, getCollectionDate, krxDiagnose };
