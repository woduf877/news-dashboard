import { useState, useEffect, useCallback } from 'react';
import WordCloud from '../components/analytics/WordCloud';
import HeatmapGrid from '../components/analytics/HeatmapGrid';
import TopKeywords from '../components/analytics/TopKeywords';
import TrendChart from '../components/analytics/TrendChart';

const CATEGORY_OPTIONS = [
  { value: 'all',        label: '전체' },
  { value: 'world',      label: '세계' },
  { value: 'technology', label: '기술' },
  { value: 'business',   label: '비즈니스' },
  { value: 'science',    label: '과학' },
  { value: 'health',     label: '건강' },
  { value: 'sports',     label: '스포츠' },
];

const HEATMAP_DAYS_OPTIONS = [
  { value: 7,  label: '최근 7일' },
  { value: 14, label: '최근 14일' },
  { value: 30, label: '최근 30일' },
];

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 ${className}`}>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default function Analytics() {
  const [category, setCategory]       = useState('all');
  const [topPeriod, setTopPeriod]     = useState('daily');
  const [heatmapDays, setHeatmapDays] = useState(14);

  const [wordCloud, setWordCloud]   = useState([]);
  const [heatmap, setHeatmap]       = useState(null);
  const [topData, setTopData]       = useState([]);
  const [trendData, setTrendData]   = useState(null);
  const [loading, setLoading]       = useState(true);

  const fetchAll = useCallback(async (cat, period, days) => {
    setLoading(true);
    try {
      const [wc, hm, top, tr] = await Promise.all([
        fetch(`/api/analytics/wordcloud?category=${cat}&days=30&limit=80`).then(r => r.json()),
        fetch(`/api/analytics/heatmap?category=${cat}&days=${days}&topN=20`).then(r => r.json()),
        fetch(`/api/analytics/top?category=${cat}&period=${period}`).then(r => r.json()),
        fetch(`/api/analytics/trends?category=${cat}&days=30`).then(r => r.json()),
      ]);
      setWordCloud(wc.data || []);
      setHeatmap(hm.data || null);
      setTopData(top.data || []);
      setTrendData(tr.data || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(category, topPeriod, heatmapDays); }, []);

  const handleCategory = (cat) => {
    setCategory(cat);
    fetchAll(cat, topPeriod, heatmapDays);
  };
  const handlePeriod = (p) => {
    setTopPeriod(p);
    fetch(`/api/analytics/top?category=${category}&period=${p}`)
      .then(r => r.json())
      .then(d => setTopData(d.data || []));
  };
  const handleHeatmapDays = (d) => {
    setHeatmapDays(d);
    fetch(`/api/analytics/heatmap?category=${category}&days=${d}&topN=20`)
      .then(r => r.json())
      .then(res => setHeatmap(res.data || null));
  };

  // 요약 통계
  const totalKeywords  = wordCloud.length;
  const topKeyword     = wordCloud[0]?.keyword || '—';
  const topCount       = wordCloud[0]?.total || 0;
  const uniqueKeywords = wordCloud.filter(w => w.total >= 3).length;

  return (
    <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">

      {/* 카테고리 필터 */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium shrink-0">카테고리</span>
        {CATEGORY_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleCategory(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              category === opt.value
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/30'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

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
            <StatCard label="추출된 키워드" value={totalKeywords.toLocaleString()} sub="지난 30일" />
            <StatCard label="유의미한 키워드" value={uniqueKeywords.toLocaleString()} sub="3회 이상 언급" />
            <StatCard label="최다 언급 키워드" value={topKeyword} sub={`${topCount.toLocaleString()}회`} />
            <StatCard
              label="TOP 10 점유율"
              value={
                wordCloud.length
                  ? `${Math.round(topData.slice(0, 10).reduce((s, d) => s + d.total, 0) /
                      Math.max(wordCloud.reduce((s, d) => s + d.total, 0), 1) * 100)}%`
                  : '—'
              }
              sub="전체 언급 대비"
            />
          </div>

          {/* 워드 클라우드 히트맵 */}
          <SectionCard title="키워드 히트맵 (지난 30일)" className="mb-6">
            <WordCloud data={wordCloud} />
          </SectionCard>

          {/* TOP 10 + 트렌드 라인 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <SectionCard title="TOP 10 키워드">
              <TopKeywords
                data={topData}
                period={topPeriod}
                onPeriodChange={handlePeriod}
              />
            </SectionCard>
            <SectionCard title="키워드 트렌드 (지난 30일)">
              <TrendChart data={trendData} />
            </SectionCard>
          </div>

          {/* 히트맵 그리드 */}
          <SectionCard title="키워드 × 날짜 히트맵">
            {/* 기간 선택 */}
            <div className="flex gap-1 mb-4">
              {HEATMAP_DAYS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleHeatmapDays(opt.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    heatmapDays === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <HeatmapGrid data={heatmap} />
          </SectionCard>
        </>
      )}
    </div>
  );
}
