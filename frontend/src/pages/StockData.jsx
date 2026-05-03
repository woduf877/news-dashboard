import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ─── 포맷 헬퍼 ──────────────────────────────────────────

function fmtRatio(r, d = 4) {
  if (r == null || isNaN(r)) return '-';
  const p = r * 100;
  return (p >= 0 ? '+' : '') + p.toFixed(d) + '%';
}
function fmtAmt(v) {
  if (v == null) return '-';
  const abs = Math.abs(v), sign = v >= 0 ? '+' : '-';
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(1) + '조';
  if (abs >= 1e8)  return sign + (abs / 1e8).toFixed(0)  + '억';
  if (abs >= 1e4)  return sign + (abs / 1e4).toFixed(0)  + '만';
  return sign + abs.toLocaleString();
}
function fmtDate(d) {
  if (!d) return '';
  // YYYYMMDD → MM-DD
  if (d.length === 8) return `${d.slice(4,6)}-${d.slice(6,8)}`;
  return d.slice(5);
}

// ─── 툴팁 ────────────────────────────────────────────────

function RatioTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const d = p?.payload ?? {};
  const numerator   = d.sumNet   ?? (d.instNet != null ? d.instNet + d.forNet + (d.fundNet || 0) : null);
  const denominator = d.sumCap   ?? d.cap ?? null;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-xl text-xs min-w-[200px] space-y-2">
      <p className="font-bold text-gray-700 dark:text-gray-200">{label}</p>
      <p style={{ color: p.color }} className="font-bold text-sm">
        수급 비율: {fmtRatio(p.value)}
      </p>
      {numerator != null && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-2 space-y-1">
          <p className="text-gray-400 font-semibold">분자 (외국인+기관+연기금 순매수)</p>
          {d.instNet != null && (
            <>
              <p className="text-gray-500">외인: <span className={d.forNet  >= 0 ? 'text-red-500' : 'text-blue-500'}>{fmtAmt(d.forNet)}원</span></p>
              <p className="text-gray-500">기관(연기금 제외): <span className={d.instNet >= 0 ? 'text-red-500' : 'text-blue-500'}>{fmtAmt(d.instNet)}원</span></p>
              <p className="text-gray-500">연기금: <span className={(d.fundNet || 0) >= 0 ? 'text-red-500' : 'text-blue-500'}>{fmtAmt(d.fundNet || 0)}원</span></p>
            </>
          )}
          <p className="text-gray-600 font-medium">합계: <span className={numerator >= 0 ? 'text-red-500' : 'text-blue-500'}>{fmtAmt(numerator)}원</span></p>
        </div>
      )}
      {denominator != null && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
          <p className="text-gray-400 font-semibold">분모 (시가총액)</p>
          <p className="text-gray-600 font-medium">{fmtAmt(denominator)}원</p>
        </div>
      )}
    </div>
  );
}

// ─── 데이터 없음 상태 ────────────────────────────────────

function EmptyState({ market, onCollect, collecting }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <span className="text-5xl">{collecting ? '⏳' : '📭'}</span>
      <p className="text-lg font-bold text-gray-700 dark:text-gray-200">
        {collecting ? '수집 중…' : `${market} 수집 데이터가 없습니다`}
      </p>
      <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
        {collecting
          ? 'KRX에서 데이터를 수집하고 있습니다. 완료되면 자동으로 표시됩니다.'
          : <>매일 <strong>18:30 KST (월~금)</strong> NXT 종료 후 자동 수집됩니다.<br />수동 수집은 아래 버튼을 눌러 즉시 실행할 수 있습니다.</>
        }
      </p>
      {!collecting && (
        <button
          onClick={onCollect}
          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          지금 수집 실행
        </button>
      )}
    </div>
  );
}

// ─── 메인 ────────────────────────────────────────────────

export default function StockData() {
  const [market,    setMarket]    = useState('KOSPI');
  const [selected,  setSelected]  = useState(null);
  const [sortBy,    setSortBy]    = useState('ratio');
  const [sortDir,   setSortDir]   = useState('desc');
  const [search,    setSearch]    = useState('');

  const [summary,      setSummary]      = useState([]);
  const [marketSeries, setMarketSeries] = useState([]);
  const [stockSeries,  setStockSeries]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [collecting,   setCollecting]   = useState(false);
  const [downloading,  setDownloading]  = useState(false);
  const [collectStatus, setCollectStatus] = useState(null);
  const wasCollectingRef = useRef(false);

  // 시장 데이터 로드
  const loadMarket = useCallback(async (m) => {
    setLoading(true);
    setSelected(null);
    setStockSeries([]);
    try {
      const [sumRes, serRes] = await Promise.all([
        fetch(`/api/stocks/summary?market=${m}`).then(r => r.json()),
        fetch(`/api/stocks/market-series?market=${m}`).then(r => r.json()),
      ]);
      setSummary(sumRes.data || []);
      setMarketSeries(serRes.data || []);
    } catch {
      setSummary([]);
      setMarketSeries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMarket(market); }, [market, loadMarket]);

  const fetchCollectStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/stocks/collect-status').then(r => r.json());
      setCollectStatus(res.data || null);
      return res.data || null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    fetchCollectStatus();
    const timer = setInterval(fetchCollectStatus, 5000);
    return () => clearInterval(timer);
  }, [fetchCollectStatus]);

  useEffect(() => {
    const running = !!collectStatus?.running;
    if (wasCollectingRef.current && !running) loadMarket(market);
    wasCollectingRef.current = running;
  }, [collectStatus?.running, loadMarket, market]);

  // 종목 클릭 시 14일 시계열 로드
  const loadStockSeries = useCallback(async (ticker) => {
    try {
      const res = await fetch(`/api/stocks/series/${ticker}`).then(r => r.json());
      setStockSeries(res.data || []);
    } catch {
      setStockSeries([]);
    }
  }, []);

  const handleSelect = (stock) => {
    setSelected(stock);
    loadStockSeries(stock.ticker);
  };

  // 수동 수집 (백그라운드 실행 후 폴링)
  const handleCollect = async () => {
    setCollecting(true);
    try {
      await fetch('/api/stocks/collect', { method: 'POST' });
      await fetchCollectStatus();
      // 최대 15분간 5초마다 서버의 실제 수집 상태 확인
      for (let i = 0; i < 180; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const status = await fetchCollectStatus();
        if (!status?.running) {
          await loadMarket(market);
          return;
        }
      }
    } finally {
      setCollecting(false);
    }
  };

  const handleDownloadRaw = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/stocks/raw-export?market=${market}`);
      if (!res.ok) throw new Error('download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      link.href = url;
      link.download = match?.[1] || `stock_raw_${market}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  // 정렬 + 검색
  const ranked = [...summary]
    .filter(s => !search.trim() || s.name.includes(search) || s.ticker.includes(search))
    .sort((a, b) => {
      const keyMap = {
        ratio: 'cumRatio',
        amount: 'cumNet',
        foreign: 'cumForNet',
        institution: 'cumInstNet',
        fund: 'cumFundNet',
      };
      const key = keyMap[sortBy] || 'cumRatio';
      return sortDir === 'asc' ? a[key] - b[key] : b[key] - a[key];
    });

  const displayStock = selected ?? ranked[0] ?? null;

  // 차트용 데이터 변환
  const marketChartData = marketSeries.map(d => ({
    date:   fmtDate(d.trade_date),
    ratio:  d.ratio,
    instNet: d.instNet,
    forNet: d.forNet,
    fundNet: d.fundNet,
    sumNet: d.sumNet,
    sumCap: d.sumCap,
  }));

  const stockChartData = stockSeries.map(d => ({
    date:    fmtDate(d.trade_date),
    ratio:   d.ratio,
    instNet: d.inst_net,
    forNet:  d.for_net,
    fundNet: d.fund_net,
    cap:     d.cap,
  }));

  const latestMarketRatio = marketChartData[marketChartData.length - 1]?.ratio ?? 0;
  const latestDate = marketSeries[marketSeries.length - 1]?.trade_date;
  const isCollecting = collecting || !!collectStatus?.running;

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

      {/* 헤더 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-200">주가 수급 데이터</p>
          {latestDate && (
            <p className="text-xs text-gray-400 mt-0.5">
              기준: {latestDate.slice(0,4)}-{latestDate.slice(4,6)}-{latestDate.slice(6,8)} NXT 종가
            </p>
          )}
        </div>
        {isCollecting && (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            수집 중
          </span>
        )}
        <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ml-auto">
          {['KOSPI', 'KOSDAQ'].map(m => (
            <button key={m} onClick={() => setMarket(m)}
              className={`px-5 py-2 text-sm font-semibold transition-colors ${
                market === m ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}>
              {m}
            </button>
          ))}
        </div>
        <button onClick={handleCollect} disabled={isCollecting}
          className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors">
          {isCollecting ? '수집 중…' : '🔄 지금 수집'}
        </button>
        <button onClick={handleDownloadRaw} disabled={loading || downloading}
          className="px-4 py-2 rounded-xl text-xs font-semibold border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 transition-colors">
          {downloading ? '다운로드 중…' : '엑셀 다운로드'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-gray-400 animate-pulse">데이터 로딩 중…</p>
        </div>
      ) : summary.length === 0 ? (
        <EmptyState market={market} onCollect={handleCollect} collecting={isCollecting} />
      ) : (
        <>
          {/* 시장 전체 차트 */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                  {market} 시장 전체 일별 수급 비율
                </p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                    분자: Σ외국인순매수 + Σ기관순매수 + Σ연기금순매수
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
              <LineChart data={marketChartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                    시총 TOP150 · 2주 누적 수급
                    <span className="text-xs font-normal text-gray-400 ml-2">{ranked.length}개</span>
                  </p>
                  <div className="flex items-center gap-1 shrink-0 max-w-full overflow-x-auto">
                    <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      {[
                        { key: 'ratio',  label: '비율' },
                        { key: 'amount', label: '합계' },
                        { key: 'foreign', label: '외국인' },
                        { key: 'institution', label: '기관' },
                        { key: 'fund',   label: '연기금' },
                      ].map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => setSortBy(opt.key)}
                          className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                            sortBy === opt.key
                              ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900'
                              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        sortDir === 'asc'
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-600 dark:text-red-400'
                      }`}>
                      {sortDir === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="종목명·코드 검색"
                  className="w-full px-3 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>

              <div className="overflow-y-auto flex-1 max-h-[480px]">
                {ranked.map((s, i) => {
                  const isSelected = displayStock?.ticker === s.ticker;
                  const pos  = s.cumRatio >= 0;
                  const amountPos = s.cumNet >= 0;
                  const foreignPos = (s.cumForNet || 0) >= 0;
                  const instPos = (s.cumInstNet || 0) >= 0;
                  const fundPos = (s.cumFundNet || 0) >= 0;
                  const barW = Math.min(Math.abs(s.cumRatio) * 4000, 50);
                  return (
                    <div key={s.ticker} onClick={() => handleSelect(s)}
                      className={`px-4 py-2.5 cursor-pointer border-b border-gray-50 dark:border-gray-800/60 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-gray-300 dark:text-gray-600 w-5 shrink-0 text-right">{i + 1}</span>
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate block">{s.name}</span>
                            <span className="text-xs text-gray-400 font-mono">{s.ticker}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className={`text-sm font-bold tabular-nums ${pos ? 'text-red-500' : 'text-blue-500'}`}>
                            {fmtRatio(s.cumRatio, 3)}
                          </p>
                          <p className={`text-[11px] font-semibold tabular-nums ${amountPos ? 'text-red-400' : 'text-blue-400'}`}>
                            합계 {fmtAmt(s.cumNet)}원
                          </p>
                          <p className="text-[10px] font-semibold tabular-nums">
                            <span className={foreignPos ? 'text-red-400' : 'text-blue-400'}>외 {fmtAmt(s.cumForNet || 0)}</span>
                            <span className="text-gray-300 dark:text-gray-600 mx-0.5">·</span>
                            <span className={instPos ? 'text-red-400' : 'text-blue-400'}>기 {fmtAmt(s.cumInstNet || 0)}</span>
                            <span className="text-gray-300 dark:text-gray-600 mx-0.5">·</span>
                            <span className={fundPos ? 'text-emerald-500' : 'text-blue-400'}>연 {fmtAmt(s.cumFundNet || 0)}</span>
                          </p>
                        </div>
                      </div>
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
                          <span className="ml-1 text-[10px] text-orange-500">(분자: Σ외국인+기관+연기금</span>
                          <span className="text-[10px] text-gray-400"> ÷ </span>
                          <span className="text-[10px] text-purple-500">분모: 최신시총)</span>
                        </p>
                        <p className={`text-2xl font-bold ${displayStock.cumRatio >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                          {fmtRatio(displayStock.cumRatio, 3)}
                        </p>
                      </div>
                    </div>

                    {/* 분자 / 분모 / 결과 카드 */}
                    <div className="mt-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        2주 누적 기준 ({displayStock.dayCount ?? '-'}거래일)
                      </p>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-orange-100 dark:border-orange-900/40">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">분자</span>
                          <p className="text-[10px] text-gray-400 mt-2 mb-0.5">Σ외국인 순매수</p>
                          <p className={`text-xs font-bold ${displayStock.cumForNet >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{fmtAmt(displayStock.cumForNet)}원</p>
                          <p className="text-[10px] text-gray-400 mt-1.5 mb-0.5">Σ기관 순매수(연기금 제외)</p>
                          <p className={`text-xs font-bold ${displayStock.cumInstNet >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{fmtAmt(displayStock.cumInstNet)}원</p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-emerald-100 dark:border-emerald-900/40">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">연기금</span>
                          <p className="text-[10px] text-gray-400 mt-2 mb-0.5">Σ연기금 순매수</p>
                          <p className={`text-xs font-bold ${(displayStock.cumFundNet || 0) >= 0 ? 'text-emerald-600' : 'text-blue-500'}`}>{fmtAmt(displayStock.cumFundNet || 0)}원</p>
                          <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-1.5">
                            <p className="text-[10px] text-gray-400">전체 합산</p>
                            <p className={`text-xs font-bold ${displayStock.cumNet >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{fmtAmt(displayStock.cumNet)}원</p>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-purple-100 dark:border-purple-900/40">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">분모</span>
                          <p className="text-[10px] text-gray-400 mt-2 mb-0.5">최신 시가총액</p>
                          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{fmtAmt(displayStock.latestCap)}원</p>
                          <p className="text-[10px] text-gray-400 mt-1.5 mb-0.5">최신 종가</p>
                          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{(displayStock.latestClose || 0).toLocaleString()}원</p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-100 dark:border-gray-800">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">결과</span>
                          <p className="text-[10px] text-gray-400 mt-2 mb-0.5">2주 수급 비율</p>
                          <p className={`text-base font-bold ${displayStock.cumRatio >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                            {fmtRatio(displayStock.cumRatio, 3)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 14일 시계열 차트 */}
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">14일 일별 수급 비율</p>
                    <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                        분자: 외국인순매수 + 기관순매수 + 연기금순매수
                      </span>
                      <span className="text-xs text-gray-300 dark:text-gray-600">÷</span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                        분모: 시가총액
                      </span>
                    </div>
                    {stockChartData.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-8">종목을 선택하면 차트가 표시됩니다</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={stockChartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 h-64 flex items-center justify-center">
                  <p className="text-sm text-gray-400">← 종목을 클릭하세요</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
