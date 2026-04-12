import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
  AreaChart, Area, Legend,
} from 'recharts';

const CATEGORY_KO = {
  world: '세계', technology: '기술', business: '비즈니스',
  science: '과학', health: '건강', sports: '스포츠',
  korea_market: '한국증시',
};
const CATEGORY_COLOR = {
  world: '#3b82f6', technology: '#8b5cf6', business: '#10b981',
  science: '#06b6d4', health: '#f43f5e', sports: '#f97316',
  korea_market: '#eab308',
};

const LANG_TABS = [
  { key: 'all', label: '전체' },
  { key: 'ko',  label: '한국어' },
  { key: 'en',  label: '영어' },
];

function TimeWindow({ window: w }) {
  if (!w) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6 text-sm">
      <span className="text-gray-400 dark:text-gray-500">분석 기간</span>
      <span className="px-3 py-1 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-400 font-medium">
        📈 {w.fromLabel}
      </span>
      <span className="text-gray-400 dark:text-gray-500">→</span>
      <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-400 font-medium">
        🕐 {w.toLabel}
      </span>
    </div>
  );
}

function KeywordRanking({ keywords, startRank = 1 }) {
  if (!keywords.length) return (
    <div className="text-center py-12 text-gray-400 dark:text-gray-600 text-sm">데이터가 없습니다</div>
  );

  const max = keywords[0]?.count || 1;

  return (
    <div className="space-y-2">
      {keywords.map((item, i) => {
        const rank = startRank + i;
        const pct = Math.round((item.count / max) * 100);
        const isKo = item.lang === 'ko';
        return (
          <div key={item.keyword} className="flex items-center gap-3">
            {/* 순위 */}
            <span className={`w-7 text-right text-xs font-bold shrink-0 ${
              rank <= 3 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'
            }`}>
              {rank}
            </span>
            {/* 키워드 + 언어 뱃지 */}
            <div className="w-32 flex items-center gap-1.5 shrink-0">
              <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                {item.keyword}
              </span>
              <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                isKo
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {isKo ? '한' : 'EN'}
              </span>
            </div>
            {/* 바 */}
            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 min-w-0">
              <div
                className={`h-2 rounded-full transition-all ${
                  i < 3 ? 'bg-blue-500' : i < 10 ? 'bg-blue-400' : 'bg-blue-300 dark:bg-blue-700'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {/* 횟수 */}
            <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right shrink-0">
              {item.count}회
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HourlyChart({ data }) {
  if (!data?.length) return null;

  // hour별 합계 집계
  const hourMap = {};
  for (const row of data) {
    const h = row.hour ? row.hour.slice(11, 13) + '시' : '?';
    if (!hourMap[h]) hourMap[h] = { hour: h, total: 0 };
    hourMap[h].total += row.count;
    hourMap[h][row.category] = (hourMap[h][row.category] || 0) + row.count;
  }

  const chartData = Object.values(hourMap).sort((a, b) => a.hour.localeCompare(b.hour));
  const categories = [...new Set(data.map(r => r.category))];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(v, name) => [v + '건', CATEGORY_KO[name] || name]}
          labelFormatter={l => `${l} 기사`}
        />
        {categories.map(cat => (
          <Area
            key={cat}
            type="monotone"
            dataKey={cat}
            stackId="1"
            stroke={CATEGORY_COLOR[cat] || '#94a3b8'}
            fill={CATEGORY_COLOR[cat] || '#94a3b8'}
            fillOpacity={0.7}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CategoryBreakdown({ breakdown }) {
  if (!breakdown?.length) return null;
  const total = breakdown.reduce((s, c) => s + c.count, 0);
  return (
    <div className="flex flex-wrap gap-2">
      {breakdown.map(({ category, count }) => (
        <div
          key={category}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: CATEGORY_COLOR[category] || '#94a3b8' }}
          />
          {CATEGORY_KO[category] || category}
          <span className="text-gray-400 dark:text-gray-500">
            {count}건 ({Math.round(count / total * 100)}%)
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Market() {
  const [data, setData]       = useState(null);
  const [hourly, setHourly]   = useState([]);
  const [lang, setLang]       = useState('all');
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kw, hr] = await Promise.all([
        fetch('/api/market/keywords?topN=50').then(r => r.json()),
        fetch('/api/market/hourly').then(r => r.json()),
      ]);
      setData(kw.data || null);
      setHourly(hr.data || []);
      setLastFetch(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = data?.keywords?.filter(k =>
    lang === 'all' ? true : k.lang === lang
  ) || [];

  const fmtTime = (d) => d?.toLocaleString('ko-KR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">

      {/* 상단 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            한국 증시 키워드 분석
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            장 마감(15:30 KST) 이후 수집된 뉴스의 핵심 키워드 통계
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white transition-colors"
        >
          {loading ? (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          ) : '↻'}
          새로고침
          {lastFetch && <span className="opacity-70">{fmtTime(lastFetch)}</span>}
        </button>
      </div>

      {/* 시간 창 */}
      {data && <TimeWindow window={data.window} />}

      {loading ? (
        <div className="flex items-center justify-center py-32 text-gray-400 dark:text-gray-600">
          <svg className="animate-spin h-8 w-8 mr-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          분석 중…
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: '분석 기사 수',     value: `${(data?.articleCount || 0).toLocaleString()}건` },
              { label: '추출 키워드',      value: `${(data?.keywords?.length || 0).toLocaleString()}개` },
              { label: '최다 키워드',      value: data?.keywords?.[0]?.keyword || '—',
                sub: `${data?.keywords?.[0]?.count || 0}회` },
              { label: '한국어 키워드',    value: `${data?.keywords?.filter(k=>k.lang==='ko').length || 0}개`,
                sub: `영어 ${data?.keywords?.filter(k=>k.lang==='en').length || 0}개` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
                {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
              </div>
            ))}
          </div>

          {/* 카테고리 분포 */}
          {data?.categoryBreakdown?.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 mb-6">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">카테고리별 기사 분포</p>
              <CategoryBreakdown breakdown={data.categoryBreakdown} />
            </div>
          )}

          {/* 시간별 기사량 */}
          {hourly.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 mb-6">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-4">시간별 기사 수</p>
              <HourlyChart data={hourly} />
            </div>
          )}

          {/* 키워드 랭킹 */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                키워드 랭킹 TOP {filtered.length}
              </p>
              <div className="flex gap-1">
                {LANG_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setLang(key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      lang === key
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-0">
              {/* 좌: TOP 1~25 */}
              <div>
                <KeywordRanking keywords={filtered.slice(0, 25)} />
              </div>
              {/* 우: TOP 26~50 */}
              {filtered.length > 25 && (
                <div>
                  <KeywordRanking keywords={filtered.slice(25, 50)} startRank={26} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
