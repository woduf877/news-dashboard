import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ─── 상수 ───────────────────────────────────────────────

const SENTIMENT_CFG = {
  bullish: { label: '상승 우세', icon: '📈', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' },
  bearish: { label: '하락 우세', icon: '📉', color: 'text-red-600 dark:text-red-400',   bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'   },
  neutral: { label: '혼조세',   icon: '➡️', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'  },
};

const IMPACT_CFG = {
  positive: { label: '상승', bar: 'bg-green-500', badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  negative: { label: '하락', bar: 'bg-red-500',   badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'   },
  neutral:  { label: '중립', bar: 'bg-gray-400',  badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'  },
};

const AGREEMENT_CFG = {
  agree:    { label: '의견 일치',    color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700', icon: '✅' },
  partial:  { label: '부분 일치',    color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700', icon: '🔶' },
  disagree: { label: '의견 불일치',  color: 'text-red-600 dark:text-red-400',   bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',   icon: '⚡' },
};

const SECTOR_ICON = { 반도체:'💾',배터리:'🔋',자동차:'🚗',바이오:'💊',에너지:'⚡',금융:'🏦',IT:'💻',소프트웨어:'🖥️',철강:'🏭',화학:'⚗️',통신:'📡',방산:'🛡️',게임:'🎮' };

// ─── 서브 컴포넌트 ──────────────────────────────────────

function TimeWindowBadge({ w }) {
  if (!w) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-gray-400 dark:text-gray-500">분석 기간</span>
      <span className="px-2.5 py-1 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-400 font-medium">📈 {w.fromLabel}</span>
      <span className="text-gray-300 dark:text-gray-700">›</span>
      <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-400 font-medium">🕐 {w.toLabel}</span>
    </div>
  );
}

// 합의도 배지
function AgreementBadge({ agreement, score }) {
  const cfg = AGREEMENT_CFG[agreement] || AGREEMENT_CFG.partial;
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${cfg.bg}`}>
      <span className="text-lg">{cfg.icon}</span>
      <div>
        <p className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</p>
        {score != null && (
          <p className="text-xs text-gray-400 dark:text-gray-600">
            일치도 {Math.round(score * 100)}%
          </p>
        )}
      </div>
    </div>
  );
}

// 단일 에이전트 분석 카드
function AgentPanel({ label, model, color, result, agreedTickers = [], disagreedTickers = [] }) {
  if (!result) return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col items-center justify-center gap-2 min-h-48">
      <span className="text-3xl opacity-30">🤖</span>
      <p className="text-sm text-gray-400 dark:text-gray-600">{label} 결과 없음</p>
    </div>
  );

  const sentCfg = SENTIMENT_CFG[result.sentiment] || SENTIMENT_CFG.neutral;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      {/* 헤더 */}
      <div className={`px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between ${color}`}>
        <div>
          <p className="text-xs font-bold text-white opacity-90">{label}</p>
          <p className="text-xs text-white opacity-70">{model}</p>
        </div>
        <div className="text-right">
          <span className="text-sm font-semibold text-white">{sentCfg.icon} {sentCfg.label}</span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* 요약 */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{result.summary}</p>
          {result.sentimentReason && (
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 italic">{result.sentimentReason}</p>
          )}
        </div>

        {/* 리뷰어 전용: Gemini 평가 의견 */}
        {result.reviewSummary && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Gemini 분석 평가</p>
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{result.reviewSummary}</p>
          </div>
        )}

        {/* 동의/반대 종목 (Groq 전용) */}
        {result.stocksDisagreed?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-red-500">Gemini와 다른 의견</p>
            {result.stocksDisagreed.map(d => (
              <div key={d.ticker} className="flex gap-2 items-start text-xs">
                <span className="font-mono text-red-400 shrink-0">{d.ticker}</span>
                <span className="text-gray-500 dark:text-gray-400">{d.reason}</span>
              </div>
            ))}
          </div>
        )}

        {/* 추가 인사이트 */}
        {result.additionalInsights && (
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg p-3">
            <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">추가 인사이트</p>
            <p className="text-xs text-purple-700 dark:text-purple-300 leading-relaxed">{result.additionalInsights}</p>
          </div>
        )}

        {/* 테마 */}
        {result.themes?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {result.themes.map(t => (
              <span key={t} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-500 dark:text-gray-400">#{t}</span>
            ))}
          </div>
        )}

        {/* 섹터 */}
        {result.sectors?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">섹터 영향</p>
            {result.sectors.map(s => {
              const ic = IMPACT_CFG[s.impact] || IMPACT_CFG.neutral;
              const icon = Object.entries(SECTOR_ICON).find(([k]) => s.name.includes(k))?.[1] || '📊';
              return (
                <div key={s.name} className="flex items-start gap-2 text-xs">
                  <span>{icon}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300 w-16 shrink-0">{s.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${ic.badge}`}>{ic.label}</span>
                  <span className="text-gray-400 dark:text-gray-600 leading-relaxed">{s.reason}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* 종목 목록 */}
        {result.stocks?.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">영향 종목 ({result.stocks.length}개)</p>
            {result.stocks.map(stock => {
              const ic = IMPACT_CFG[stock.impact] || IMPACT_CFG.neutral;
              const pct = Math.round((stock.score || 0) * 100);
              const isAgreed    = agreedTickers.includes(stock.ticker);
              const isDisagreed = disagreedTickers.includes(stock.ticker);
              return (
                <div key={stock.ticker} className={`p-3 rounded-xl border transition-colors ${
                  isAgreed    ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10' :
                  isDisagreed ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10' :
                                'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30'
                }`}>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">{stock.name}</span>
                    <span className="font-mono text-xs text-gray-400 dark:text-gray-600">{stock.ticker}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-600">{stock.market}</span>
                    <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full font-semibold ${ic.badge}`}>{ic.label}</span>
                    {isAgreed    && <span className="text-[10px] text-green-500">✓ 양쪽 동의</span>}
                    {isDisagreed && <span className="text-[10px] text-red-500">⚡ 의견 차이</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${ic.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{pct}%</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{stock.reason}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// 종합 결과 패널
const CONSISTENCY_CFG = {
  high:   { label: '높음', color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',  icon: '🎯' },
  medium: { label: '보통', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700', icon: '🔶' },
  low:    { label: '낮음', color: 'text-red-600 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',           icon: '⚡' },
};

function SummaryPanel({ summary }) {
  if (!summary) return null;
  const sentCfg  = SENTIMENT_CFG[summary.sentiment] || SENTIMENT_CFG.neutral;
  const consCfg  = CONSISTENCY_CFG[summary.consistency] || CONSISTENCY_CFG.medium;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="px-5 py-3 bg-gray-800 dark:bg-gray-700 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-white">📊 {summary.runCount}회 종합 결과</p>
          <p className="text-xs text-gray-400">Gemini + Groq 각 {summary.runCount}회 실행 후 집계</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{sentCfg.icon} {sentCfg.label}</span>
          <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${consCfg.bg} ${consCfg.color}`}>
            {consCfg.icon} 일치도 {consCfg.label}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* 테마 */}
        {summary.themes?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {summary.themes.map(t => (
              <span key={t} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-600 dark:text-gray-300 font-medium">#{t}</span>
            ))}
          </div>
        )}

        {/* 섹터 */}
        {summary.sectors?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">반복 등장 섹터</p>
            <div className="flex flex-wrap gap-2">
              {summary.sectors.map(s => {
                const ic = IMPACT_CFG[s.impact] || IMPACT_CFG.neutral;
                return (
                  <span key={s.name} className={`px-2 py-0.5 rounded text-xs font-medium ${ic.badge}`}>
                    {s.name} {ic.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 종목 */}
        {summary.stocks?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              2회 이상 등장 종목 ({summary.stocks.length}개)
            </p>
            {summary.stocks.map(stock => {
              const ic  = IMPACT_CFG[stock.impact] || IMPACT_CFG.neutral;
              const pct = Math.round((stock.score || 0) * 100);
              return (
                <div key={stock.ticker} className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">{stock.name}</span>
                    <span className="font-mono text-xs text-gray-400">{stock.ticker}</span>
                    <span className="text-xs text-gray-400">{stock.market}</span>
                    <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full font-semibold ${ic.badge}`}>{ic.label}</span>
                    <span className="text-[10px] text-blue-500 font-medium">{stock.appearCount}/{summary.runCount}회 등장</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${ic.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!summary.stocks?.length && !summary.sectors?.length && (
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-4">2회 이상 공통 등장 종목이 없습니다</p>
        )}
      </div>
    </div>
  );
}

// 3회 상세 결과 (접기/펼치기)
function RunsDetail({ runs }) {
  const [open, setOpen] = useState(false);
  if (!runs?.length) return null;

  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          🔍 {runs.length}회 상세 결과 보기
        </span>
        <span className="text-gray-400 text-lg">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-4 space-y-6 bg-white dark:bg-gray-900">
          {runs.map((run, i) => (
            <div key={i}>
              <p className="text-xs font-bold text-gray-400 dark:text-gray-600 mb-3 uppercase tracking-wider">
                — {i + 1}회차 —
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AgentPanel
                  label={`Gemini Flash — ${i + 1}회차`}
                  model="Google Gemini"
                  color="bg-blue-600"
                  result={run.geminiResult}
                />
                <AgentPanel
                  label={`Groq Llama 3.3 70B — ${i + 1}회차`}
                  model="Groq"
                  color="bg-orange-500"
                  result={run.groqResult}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HourlyMiniChart({ data }) {
  if (!data?.length) return null;
  const hourMap = {};
  for (const row of data) {
    const h = (row.hour || '').slice(11, 13) + '시';
    hourMap[h] = (hourMap[h] || 0) + row.count;
  }
  const chartData = Object.entries(hourMap).sort().map(([hour, count]) => ({ hour, count }));
  return (
    <ResponsiveContainer width="100%" height={72}>
      <AreaChart data={chartData} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
        <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickLine={false} />
        <Tooltip formatter={v => [v + '건', '기사']} />
        <Area type="monotone" dataKey="count" stroke="#eab308" fill="#fef9c3" fillOpacity={0.8} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function NoApiKeyGuide() {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 space-y-3">
      <h3 className="font-bold text-amber-800 dark:text-amber-400">🔑 AI API 키 2개 설정이 필요합니다</h3>
      <p className="text-sm text-amber-700 dark:text-amber-500">이 기능은 Gemini(분석) + Groq(리뷰) 듀얼 에이전트를 사용합니다. 두 API 모두 무료입니다.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { name: 'Google Gemini', role: '1차 분석가', key: 'GEMINI_API_KEY', url: 'aistudio.google.com/apikey', free: '1일 1500회 무료' },
          { name: 'Groq',         role: '감독·리뷰어', key: 'GROQ_API_KEY',   url: 'console.groq.com/keys',    free: '1일 14400회 무료' },
        ].map(({ name, role, key, url, free }) => (
          <div key={name} className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">{name} <span className="text-xs font-normal text-amber-600 dark:text-amber-500">— {role}</span></p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">1. <strong>{url}</strong> 에서 API 키 발급</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">2. 무료: {free}</p>
            <pre className="mt-2 bg-gray-100 dark:bg-gray-800 rounded p-2 text-xs text-gray-700 dark:text-gray-300">{key}=발급받은키</pre>
          </div>
        ))}
      </div>
      <pre className="bg-amber-100 dark:bg-amber-900/40 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
{`# backend/.env 파일에 추가
GEMINI_API_KEY=여기에_Gemini_키
GROQ_API_KEY=여기에_Groq_키`}
      </pre>
      <p className="text-xs text-amber-600 dark:text-amber-600">설정 후: <code>pm2 restart news-dashboard</code></p>
    </div>
  );
}

// ─── 메인 페이지 ────────────────────────────────────────

export default function Market() {
  const [data, setData]           = useState(null);
  const [hourly, setHourly]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const pollRef = useRef(null);

  const fetchData = async () => {
    try {
      const [res, hrRes] = await Promise.all([
        fetch('/api/market/analysis').then(r => r.json()),
        fetch('/api/market/hourly').then(r => r.json()),
      ]);
      setData(res.data || null);
      setHourly(hrRes.data || []);
      if (res.data?.status?.status === 'pending') {
        pollRef.current = setTimeout(fetchData, 2000);
      } else {
        setAnalyzing(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); return () => clearTimeout(pollRef.current); }, []);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    const res = await fetch('/api/market/analyze', { method: 'POST' });
    if (!res.ok) { setAnalyzing(false); return; }
    setTimeout(fetchData, 1500);
  };

  const analysis     = data?.analysis;
  const status       = data?.status;
  const isPending    = status?.status === 'pending';
  const isError      = status?.status === 'error';
  const aiConfigured = data?.aiConfigured;

  // 양쪽이 동의한 ticker / 의견 다른 ticker 계산
  const agreedTickers = (() => {
    if (!analysis?.gemini?.stocks || !analysis?.groq?.stocks) return [];
    const groqTickers = new Set(analysis.groq.stocks.map(s => s.ticker));
    return analysis.gemini.stocks
      .filter(s => groqTickers.has(s.ticker))
      .filter(s => {
        const g = analysis.groq.stocks.find(x => x.ticker === s.ticker);
        return g && g.impact === s.impact;
      })
      .map(s => s.ticker);
  })();

  const disagreedTickers = (analysis?.groq?.stocksDisagreed || []).map(d => d.ticker);

  const fmtTime = iso => iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* ── 헤더 ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">한국 증시 AI 듀얼 분석</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Gemini(1차 분석) + Groq(감독·리뷰) 이중 검증
          </p>
          {data?.window && <div className="mt-2"><TimeWindowBadge w={data.window} /></div>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={handleAnalyze}
            disabled={analyzing || isPending || !aiConfigured}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white transition-colors"
          >
            {(analyzing || isPending)
              ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>분석 중…</>
              : '🤖 지금 분석'}
          </button>
          {analysis?.analyzed_at && (
            <p className="text-xs text-gray-400 dark:text-gray-600">
              마지막 분석: {fmtTime(analysis.analyzed_at)}
            </p>
          )}
        </div>
      </div>

      {/* ── API 키 안내 ── */}
      {!loading && !aiConfigured && <NoApiKeyGuide />}

      {/* ── 오류 ── */}
      {isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
          ⚠️ {status.error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-32 text-gray-400 dark:text-gray-600">
          <svg className="animate-spin h-8 w-8 mr-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          로딩 중…
        </div>
      ) : (
        <>
          {/* ── 요약 바 ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '분석 기사',     value: `${(data?.articleCount || 0).toLocaleString()}건` },
              { label: 'Gemini 종목',  value: `${analysis?.gemini?.stocks?.length || 0}개` },
              { label: 'Groq 종목',    value: `${analysis?.groq?.stocks?.length   || 0}개` },
              { label: '양쪽 동의 종목', value: `${agreedTickers.length}개`, highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`rounded-2xl border p-4 ${highlight ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'}`}>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
                <p className={`text-xl font-bold ${highlight ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* ── 분석 결과 없음 ── */}
          {!analysis && aiConfigured && !isPending && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center">
              <p className="text-4xl mb-3">🤖</p>
              <p className="text-gray-600 dark:text-gray-400 font-medium">아직 분석 결과가 없습니다</p>
              <p className="text-sm text-gray-400 dark:text-gray-600 mt-1">"지금 분석" 버튼을 눌러 Gemini + Groq 듀얼 분석을 시작하세요</p>
            </div>
          )}

          {/* ── 합의도 + 시간별 차트 ── */}
          {analysis && (
            <>
              <div className="flex flex-wrap items-center gap-4">
                {analysis.agreement && (
                  <AgreementBadge
                    agreement={analysis.agreement}
                    score={analysis.agreement_score}
                  />
                )}
                {hourly.length > 0 && (
                  <div className="flex-1 min-w-48 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                    <p className="text-xs text-gray-400 dark:text-gray-600 mb-1">시간별 기사 수</p>
                    <HourlyMiniChart data={hourly} />
                  </div>
                )}
              </div>

              {/* ── 종합 결과 ── */}
              {analysis.summary && <SummaryPanel summary={analysis.summary} />}

              {/* ── 3회 상세 결과 (접기/펼치기) ── */}
              {analysis.runs && <RunsDetail runs={analysis.runs} />}

              {/* ── 대표 듀얼 패널 (마지막 성공 회차) ── */}
              {(analysis.gemini || analysis.groq) && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mb-3">대표 회차 결과 (Gemini + Groq)</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <AgentPanel
                      label="Gemini Flash — 1차 분석가"
                      model="Google Gemini"
                      color="bg-blue-600"
                      result={analysis.gemini}
                      agreedTickers={agreedTickers}
                      disagreedTickers={disagreedTickers}
                    />
                    <AgentPanel
                      label="Groq Llama 3.3 70B — 감독·리뷰어"
                      model="Groq"
                      color="bg-orange-500"
                      result={analysis.groq}
                      agreedTickers={agreedTickers}
                      disagreedTickers={disagreedTickers}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
