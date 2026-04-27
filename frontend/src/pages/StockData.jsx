import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ─── 종목 원본 데이터 ─────────────────────────────────────
// [ticker, name, market, cap(조), avgInstNet(억/일), avgForNet(억/일)]

const STOCKS_RAW = [
  // ── KOSPI 100 ──────────────────────────────────────────
  ['005930','삼성전자','KOSPI',350, 200, 300],
  ['000660','SK하이닉스','KOSPI',142, 150, 200],
  ['373220','LG에너지솔루션','KOSPI',72,-50, 30],
  ['207940','삼성바이오로직스','KOSPI',55,-30, 40],
  ['005380','현대차','KOSPI',51, 60, 50],
  ['000270','기아','KOSPI',45, 40, 35],
  ['105560','KB금융','KOSPI',34, 30, 20],
  ['068270','셀트리온','KOSPI',33,-20, 15],
  ['035420','NAVER','KOSPI',30,-10, 25],
  ['006400','삼성SDI','KOSPI',28,-40,-20],
  ['055550','신한지주','KOSPI',25, 25, 15],
  ['012450','한화에어로스페이스','KOSPI',24, 80, 70],
  ['051910','LG화학','KOSPI',20,-50,-30],
  ['028260','삼성물산','KOSPI',20, 15, 10],
  ['329180','HD현대중공업','KOSPI',19, 60, 50],
  ['086790','하나금융지주','KOSPI',18, 20, 12],
  ['012330','현대모비스','KOSPI',16, 15, 10],
  ['005490','POSCO홀딩스','KOSPI',15,-20,-10],
  ['034730','SK','KOSPI',15, 10,  8],
  ['017670','SK텔레콤','KOSPI',13,  8,  5],
  ['003670','포스코퓨처엠','KOSPI',12,-30,-15],
  ['066570','LG전자','KOSPI',12, -8, -5],
  ['009540','HD한국조선해양','KOSPI',12, 40, 30],
  ['042660','한화오션','KOSPI',11, 50, 40],
  ['035720','카카오','KOSPI',11,-15, -8],
  ['259960','크래프톤','KOSPI',11, 12,  8],
  ['000810','삼성화재','KOSPI',11, 10,  7],
  ['010130','고려아연','KOSPI',10, 20, 15],
  ['096770','SK이노베이션','KOSPI',10,-15,-10],
  ['009150','삼성전기','KOSPI',8,  5,  3],
  ['003550','LG','KOSPI',8,  4,  3],
  ['010140','삼성중공업','KOSPI',8, 25, 20],
  ['086280','현대글로비스','KOSPI',8,  6,  4],
  ['450080','에코프로머티리얼즈','KOSPI',8,-30,-20],
  ['034020','두산에너빌리티','KOSPI',8, 20, 15],
  ['047810','한국항공우주','KOSPI',7, 15, 12],
  ['267250','HD현대','KOSPI',7,  8,  6],
  ['030200','KT','KOSPI',7,  5,  4],
  ['011070','LG이노텍','KOSPI',6,  3,  2],
  ['000100','유한양행','KOSPI',6,  5,  4],
  ['003490','대한항공','KOSPI',9,  8,  6],
  ['033780','KT&G','KOSPI',9,  7,  5],
  ['025540','HD현대일렉트릭','KOSPI',5, 15, 12],
  ['011200','HMM','KOSPI',5, 10,  8],
  ['241560','두산밥캣','KOSPI',5,  6,  5],
  ['097950','CJ제일제당','KOSPI',5,  4,  3],
  ['128940','한미약품','KOSPI',5,  5,  4],
  ['090430','아모레퍼시픽','KOSPI',5, -4,  3],
  ['018260','삼성에스디에스','KOSPI',5,  3,  2],
  ['454910','두산로보틱스','KOSPI',5, 10,  8],
  ['004020','현대제철','KOSPI',5, -5, -3],
  ['024110','기업은행','KOSPI',5,  4,  3],
  ['271560','오리온','KOSPI',4,  3,  2],
  ['032640','LG유플러스','KOSPI',4,  2,  1],
  ['006260','LS','KOSPI',4,  5,  4],
  ['088350','한화생명','KOSPI',4,  3,  2],
  ['006800','미래에셋증권','KOSPI',4,  3,  2],
  ['010950','S-Oil','KOSPI',4, -3, -2],
  ['009830','한화솔루션','KOSPI',4, -3, -2],
  ['011170','롯데케미칼','KOSPI',4, -4, -3],
  ['161390','한국타이어앤테크놀로지','KOSPI',3,  3,  2],
  ['011780','금호석유','KOSPI',3,  2,  1],
  ['036460','한국가스공사','KOSPI',3, -2,  1],
  ['180640','한진칼','KOSPI',3,  4,  3],
  ['071050','한국금융지주','KOSPI',3,  2,  2],
  ['016360','삼성증권','KOSPI',3,  2,  2],
  ['326030','SK바이오팜','KOSPI',3,  2,  1],
  ['036570','엔씨소프트','KOSPI',3, -3, -2],
  ['004170','신세계','KOSPI',3, -2,  1],
  ['018880','한온시스템','KOSPI',3, -2, -1],
  ['001450','현대해상','KOSPI',3,  2,  1],
  ['010120','LS ELECTRIC','KOSPI',3,  3,  2],
  ['006280','녹십자','KOSPI',2,  1,  1],
  ['004370','농심','KOSPI',2,  1,  1],
  ['000080','하이트진로','KOSPI',2,  1,  1],
  ['007310','오뚜기','KOSPI',2,  1,  1],
  ['185750','종근당','KOSPI',2,  2,  1],
  ['004800','효성','KOSPI',2,  1,  1],
  ['010060','OCI홀딩스','KOSPI',2, -2, -1],
  ['229640','LS전선','KOSPI',2,  2,  1],
  ['047040','대우건설','KOSPI',2, -1,  1],
  ['006360','GS건설','KOSPI',2, -2, -1],
  ['004990','롯데지주','KOSPI',2, -1,  1],
  ['023530','롯데쇼핑','KOSPI',2, -2, -1],
  ['069960','현대백화점','KOSPI',2, -1,  1],
  ['000720','현대건설','KOSPI',4,  3,  2],
  ['282330','BGF리테일','KOSPI',2,  1,  1],
  ['007070','GS리테일','KOSPI',1.5, 1,  1],
  ['204320','만도','KOSPI',2, -1,  1],
  ['001040','CJ','KOSPI',2,  1,  1],
  ['120110','코오롱인더','KOSPI',1.5,-1,-1],
  ['033640','한국콜마','KOSPI',1.5, 1,  1],
  ['028670','팬오션','KOSPI',2,  2,  1],
  ['001230','동국제강','KOSPI',1.5,-1,  1],
  ['002380','KCC','KOSPI',2,  1,  1],
  ['005300','롯데웰푸드','KOSPI',2,  1,  1],
  ['002790','DL이앤씨','KOSPI',2, -1,  1],
  ['251270','넷마블','KOSPI',2, -2, -1],
  ['139480','이마트','KOSPI',5, -3,  2],
  ['030000','제일기획','KOSPI',1,  1,  1],
  ['009410','태영건설','KOSPI',1, -1, -1],

  // ── KOSDAQ 100 ─────────────────────────────────────────
  ['247540','에코프로비엠','KOSDAQ',13,-30,-20],
  ['086520','에코프로','KOSDAQ',17,-40,-25],
  ['196170','알테오젠','KOSDAQ',11, 35, 25],
  ['028300','HLB','KOSDAQ',6,-25,-18],
  ['277810','레인보우로보틱스','KOSDAQ',4, 20, 15],
  ['141080','리가켐바이오','KOSDAQ',3,  8,  6],
  ['377300','카카오페이','KOSDAQ',5,-18,-12],
  ['096530','씨젠','KOSDAQ',1, -5, -3],
  ['086900','메디톡스','KOSDAQ',1, -4, -3],
  ['290650','엘앤씨바이오','KOSDAQ',2, -3,  2],
  ['214450','파마리서치','KOSDAQ',2,  5,  4],
  ['068760','셀트리온제약','KOSDAQ',3,-12, -8],
  ['069620','대웅제약','KOSDAQ',2, -2,  2],
  ['035900','JYP엔터','KOSDAQ',2, -4, -3],
  ['041510','에스엠','KOSDAQ',2, -3, -2],
  ['122870','YG엔터테인먼트','KOSDAQ',1, -2, -1],
  ['253450','스튜디오드래곤','KOSDAQ',2, -2, -1],
  ['263750','펄어비스','KOSDAQ',2, -5, -3],
  ['112040','위메이드','KOSDAQ',1, -4, -2],
  ['293490','카카오게임즈','KOSDAQ',2, -5, -3],
  ['095660','네오위즈','KOSDAQ',1, -2, -1],
  ['240810','원익IPS','KOSDAQ',2,  3,  2],
  ['357780','솔브레인','KOSDAQ',2,  4,  3],
  ['039030','이오테크닉스','KOSDAQ',1,  2,  1],
  ['067160','아프리카TV','KOSDAQ',1, -2, -1],
  ['131970','두산테스나','KOSDAQ',1,  3,  2],
  ['226950','올릭스','KOSDAQ',0.5,-1, -1],
  ['237690','에스티팜','KOSDAQ',1,  2,  1],
  ['039200','오스코텍','KOSDAQ',0.8,-1, -1],
  ['085660','차바이오텍','KOSDAQ',0.8,-2, -1],
  ['069080','웹젠','KOSDAQ',0.8,-2, -2],
  ['041140','넥슨게임즈','KOSDAQ',1,  1,  1],
  ['192080','더블유게임즈','KOSDAQ',1, -1, -1],
  ['112110','에이치디씨현대산업개발','KOSDAQ',0.5,-2,-1],
  ['215600','신라젠','KOSDAQ',0.3,-2, -2],
  // 이하 생성 종목 (65개)
];

// ─── 생성 종목으로 KOSDAQ 100개 채우기 ──────────────────

const GEN_PREF = ['한국','대한','국제','동양','태평양','일진','삼보','삼화','동부','중앙',
                   '극동','대성','신성','미래','새한','코리아','유니','경남','세일','삼영',
                   '현성','성진','삼익','신창','영진','창원','에이','비이','씨이','디이'];
const GEN_SUFF_KQ = ['바이오','테크','솔루션','시스템','헬스케어','로봇','나노','옵틱스',
                      '세미콘','소프트','데이터','메디칼','진단','큐어','랩','에스티',
                      '이엔에스','파마','젠','이노'];

function buildAllStocks() {
  // 기존 원본
  const raw = STOCKS_RAW.map(([ticker, name, market, capT, instB, forB]) => ({
    ticker, name, market,
    baseCap:  capT  * 1e12,
    baseInst: instB * 1e8,
    baseFor:  forB  * 1e8,
  }));

  // KOSDAQ 생성 종목
  const kqCount = raw.filter(s => s.market === 'KOSDAQ').length;
  const need    = 100 - kqCount;
  const used    = new Set(raw.map(s => s.name));
  let ti = 500000, pi = 0, si = 0;

  for (let i = 0; i < need; i++) {
    let name;
    do {
      name = GEN_PREF[pi] + GEN_SUFF_KQ[si];
      si = (si + 1) % GEN_SUFF_KQ.length;
      if (si === 0) pi = (pi + 1) % GEN_PREF.length;
    } while (used.has(name));
    used.add(name);

    const cap  = (0.15 + Math.random() * 0.9) * 1e12;  // KOSDAQ 시총 더 작게
    // KOSDAQ: 매도 압력 강함 → 60% 확률로 음수
    const sign = () => (Math.random() > 0.6 ? 1 : -1);
    raw.push({
      ticker:   String(ti).padStart(6, '0'),
      name,
      market:   'KOSDAQ',
      baseCap:  cap,
      baseInst: sign() * cap * (0.002 + Math.random() * 0.005),
      baseFor:  sign() * cap * (0.001 + Math.random() * 0.003),
    });
    ti += Math.floor(10 + Math.random() * 90);
  }
  return raw;
}

// ─── 거래일 생성 ─────────────────────────────────────────

function buildTradingDates() {
  const dates = [], today = new Date();
  let off = 0;
  while (dates.length < 14) {
    const d = new Date(today);
    d.setDate(d.getDate() - off++);
    if (d.getDay() !== 0 && d.getDay() !== 6)
      dates.unshift(d.toISOString().slice(0, 10));
  }
  return dates;
}

function generateDays(stock, dates) {
  // KOSDAQ는 변동성 2배, 종가 등락도 더 크게
  const vol = stock.market === 'KOSDAQ' ? 5.5 : 3;
  const capVol = stock.market === 'KOSDAQ' ? 0.09 : 0.05;
  return dates.map(date => {
    const cap     = Math.round(stock.baseCap * (1 + (Math.random() - 0.5) * capVol));
    const instNet = Math.round(stock.baseInst + (Math.random() - 0.5) * Math.abs(stock.baseInst) * vol);
    const forNet  = Math.round(stock.baseFor  + (Math.random() - 0.5) * Math.abs(stock.baseFor)  * vol);
    return { date, cap, instNet, forNet, ratio: (instNet + forNet) / cap };
  });
}

// ─── 포맷 헬퍼 ──────────────────────────────────────────

function fmtRatio(r, d = 4) {
  if (r == null) return '-';
  const p = r * 100;
  return (p >= 0 ? '+' : '') + p.toFixed(d) + '%';
}
function fmtAmt(v) {
  if (v == null) return '-';
  const abs = Math.abs(v), sign = v >= 0 ? '+' : '-';
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(1) + '조';
  if (abs >= 1e8)  return sign + (abs / 1e8).toFixed(0)  + '억';
  return sign + abs.toLocaleString();
}
function fmtDate(d) { return d ? d.slice(5) : ''; }

// ─── 툴팁 ────────────────────────────────────────────────

function RatioTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const d = p?.payload ?? {};

  // 종목 차트: instNet + forNet = 분자, cap = 분모
  // 시장 차트: sumNet = 분자, sumCap = 분모
  const numerator   = d.sumNet   != null ? d.sumNet   : (d.instNet != null ? d.instNet + d.forNet : null);
  const denominator = d.sumCap   != null ? d.sumCap   : (d.cap     != null ? d.cap                : null);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-xl text-xs min-w-[200px] space-y-2">
      <p className="font-bold text-gray-700 dark:text-gray-200">{label}</p>

      {/* 결과 비율 */}
      <p style={{ color: p.color }} className="font-bold text-sm">
        수급 비율: {fmtRatio(p.value)}
      </p>

      {/* 분자 */}
      {numerator != null && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-2 space-y-1">
          <p className="text-gray-400 font-semibold">분자 (기관+외인 순매수)</p>
          {d.instNet != null ? (
            <>
              <p className="text-gray-500">기관 순매수: <span className={d.instNet >= 0 ? 'text-red-500' : 'text-blue-500'}>{fmtAmt(d.instNet)}원</span></p>
              <p className="text-gray-500">외인 순매수: <span className={d.forNet  >= 0 ? 'text-red-500' : 'text-blue-500'}>{fmtAmt(d.forNet)}원</span></p>
              <p className="text-gray-600 font-medium">합계: <span className={numerator >= 0 ? 'text-red-500' : 'text-blue-500'}>{fmtAmt(numerator)}원</span></p>
            </>
          ) : (
            <p className="text-gray-600 font-medium">Σ합계: <span className={numerator >= 0 ? 'text-red-500' : 'text-blue-500'}>{fmtAmt(numerator)}원</span></p>
          )}
        </div>
      )}

      {/* 분모 */}
      {denominator != null && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
          <p className="text-gray-400 font-semibold">분모 (시가총액)</p>
          <p className="text-gray-600 font-medium">{fmtAmt(denominator)}원</p>
        </div>
      )}
    </div>
  );
}

// ─── 메인 ────────────────────────────────────────────────

export default function StockData() {
  const [market,   setMarket]   = useState('KOSPI');
  const [selected, setSelected] = useState(null);
  const [sortDir,  setSortDir]  = useState('asc');   // 'asc' | 'desc'
  const [search,   setSearch]   = useState('');

  const dates  = useMemo(() => buildTradingDates(), []);
  const stocks  = useMemo(() => {
    const defs = buildAllStocks();
    return defs.map(s => {
      const days      = generateDays(s, dates);
      const latestCap = days[days.length - 1].cap;
      const cumNet    = days.reduce((sum, d) => sum + d.instNet + d.forNet, 0);
      return { ...s, days, cumRatio: cumNet / latestCap };
    });
  }, [dates]);

  const marketStocks = useMemo(
    () => stocks.filter(s => s.market === market),
    [stocks, market]
  );

  const ranked = useMemo(() => {
    let list = marketStocks;
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(s => s.name.includes(q) || s.ticker.includes(q));
    }
    return [...list].sort((a, b) =>
      sortDir === 'asc' ? a.cumRatio - b.cumRatio : b.cumRatio - a.cumRatio
    );
  }, [marketStocks, sortDir, search]);

  const displayStock = useMemo(() => {
    if (selected && selected.market === market) return selected;
    return ranked[0] ?? null;
  }, [selected, market, ranked]);

  // 시장 전체 일별 수급 비율
  const marketChart = useMemo(() => dates.map(date => {
    let sumNet = 0, sumCap = 0;
    for (const s of marketStocks) {
      const d = s.days.find(x => x.date === date);
      if (d) { sumNet += d.instNet + d.forNet; sumCap += d.cap; }
    }
    return { date: fmtDate(date), ratio: sumNet / sumCap, sumNet, sumCap };
  }), [dates, marketStocks]);

  const stockChart = useMemo(() =>
    displayStock?.days.map(d => ({
      date:    fmtDate(d.date),
      ratio:   d.ratio,
      instNet: d.instNet,
      forNet:  d.forNet,
      cap:     d.cap,
    })) ?? [], [displayStock]
  );

  const latestMarketRatio = marketChart[marketChart.length - 1]?.ratio ?? 0;

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

      {/* 상단 헤더 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
          🧪 가상 데이터 미리보기
        </span>
        <p className="text-xs text-gray-400">실제 수집 시 KRX API → SQLite</p>
        <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ml-auto">
          {['KOSPI', 'KOSDAQ'].map(m => (
            <button key={m} onClick={() => { setMarket(m); setSelected(null); }}
              className={`px-5 py-2 text-sm font-semibold transition-colors ${
                market === m ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* 시장 전체 차트 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
              {market} 시장 전체 일별 수급 비율
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                분자: Σ기관순매수 + Σ외인순매수
              </span>
              <span className="text-xs text-gray-300 dark:text-gray-600">÷</span>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                분모: Σ시가총액
              </span>
              <span className="text-xs text-gray-400">· NXT 종가 기준</span>
            </div>
          </div>
          <p className={`text-xl font-bold ${latestMarketRatio >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
            {fmtRatio(latestMarketRatio)}
          </p>
        </div>
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={marketChart} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => fmtRatio(v, 3)} tick={{ fontSize: 10 }} width={72} />
            <Tooltip content={<RatioTooltip />} />
            <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 2" />
            <Line type="monotone" dataKey="ratio" name="수급 비율"
              stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 하단: 목록 + 상세 */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* 종목 목록 */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                종목별 2주 누적 수급 비율
                <span className="text-xs font-normal text-gray-400 ml-2">{ranked.length}개</span>
              </p>
              <button
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  sortDir === 'asc'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-600 dark:text-red-400'
                }`}
              >
                {sortDir === 'asc' ? '↑ 오름차순' : '↓ 내림차순'}
              </button>
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="종목명·코드 검색"
              className="w-full px-3 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="overflow-y-auto flex-1 max-h-[480px]">
            {ranked.map((s, i) => {
              const isSelected = displayStock?.ticker === s.ticker;
              const pos        = s.cumRatio >= 0;
              const barW       = Math.min(Math.abs(s.cumRatio) * 4000, 50);

              return (
                <div key={s.ticker} onClick={() => setSelected(s)}
                  className={`px-4 py-2.5 cursor-pointer border-b border-gray-50 dark:border-gray-800/60 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-gray-300 dark:text-gray-600 w-5 shrink-0 text-right">{i + 1}</span>
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate block">{s.name}</span>
                        <span className="text-xs text-gray-400 font-mono">{s.ticker}</span>
                      </div>
                    </div>
                    <span className={`text-sm font-bold tabular-nums shrink-0 ml-2 ${pos ? 'text-red-500' : 'text-blue-500'}`}>
                      {fmtRatio(s.cumRatio, 3)}
                    </span>
                  </div>
                  {/* 비율 바 */}
                  <div className="ml-7 mt-1.5 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className={`h-full rounded-full ${pos ? 'bg-red-400' : 'bg-blue-400'}`}
                      style={{ width: `${barW}%`, marginLeft: pos ? '50%' : `${50 - barW}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 상세 */}
        <div className="xl:col-span-3 space-y-4">
          {displayStock ? (
            <>
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{displayStock.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs text-gray-400">{displayStock.ticker}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{displayStock.market}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 mb-0.5">
                2주 누적 수급 비율
                <span className="ml-1 text-[10px] text-orange-500">(분자: Σ14일순매수</span>
                <span className="text-[10px] text-gray-400"> ÷ </span>
                <span className="text-[10px] text-purple-500">분모: 최신시총)</span>
              </p>
                    <p className={`text-2xl font-bold ${displayStock.cumRatio >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                      {fmtRatio(displayStock.cumRatio, 3)}
                    </p>
                  </div>
                </div>
                {/* 분자 / 분모 / 비율 카드 — 2주 누적 기준 */}
                {(() => {
                  const cumInstNet = displayStock.days.reduce((s, d) => s + d.instNet, 0);
                  const cumForNet  = displayStock.days.reduce((s, d) => s + d.forNet,  0);
                  const cumNet     = cumInstNet + cumForNet;
                  const latestCap  = displayStock.days[displayStock.days.length - 1].cap;
                  return (
                    <div className="mt-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">2주 누적 기준 ({displayStock.days.length}거래일)</p>
                      <div className="grid grid-cols-3 gap-3">
                        {/* 분자 */}
                        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-orange-100 dark:border-orange-900/40">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">분자</span>
                          <p className="text-[10px] text-gray-400 mt-2 mb-0.5">Σ기관 순매수</p>
                          <p className={`text-xs font-bold ${cumInstNet >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{fmtAmt(cumInstNet)}원</p>
                          <p className="text-[10px] text-gray-400 mt-1.5 mb-0.5">Σ외인 순매수</p>
                          <p className={`text-xs font-bold ${cumForNet >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{fmtAmt(cumForNet)}원</p>
                          <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-1.5">
                            <p className="text-[10px] text-gray-400">합산</p>
                            <p className={`text-xs font-bold ${cumNet >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{fmtAmt(cumNet)}원</p>
                          </div>
                        </div>

                        {/* 분모 */}
                        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-purple-100 dark:border-purple-900/40">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">분모</span>
                          <p className="text-[10px] text-gray-400 mt-2 mb-0.5">최신 시가총액</p>
                          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{fmtAmt(latestCap)}원</p>
                        </div>

                        {/* 결과 */}
                        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-100 dark:border-gray-800">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">결과</span>
                          <p className="text-[10px] text-gray-400 mt-2 mb-0.5">2주 수급 비율</p>
                          <p className={`text-base font-bold ${displayStock.cumRatio >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{fmtRatio(displayStock.cumRatio, 3)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">14일 일별 수급 비율</p>
                <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                    분자: 기관순매수 + 외인순매수
                  </span>
                  <span className="text-xs text-gray-300 dark:text-gray-600">÷</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                    분모: 시가총액
                  </span>
                  <span className="text-xs text-gray-400">· NXT 종가 기준</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={stockChart} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => fmtRatio(v, 3)} tick={{ fontSize: 10 }} width={72} />
                    <Tooltip content={<RatioTooltip />} />
                    <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="ratio" name="수급 비율"
                      stroke="#8b5cf6" strokeWidth={2.5}
                      dot={{ r: 3.5, fill: '#8b5cf6' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 h-64 flex items-center justify-center">
              <p className="text-sm text-gray-400">← 종목을 클릭하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
