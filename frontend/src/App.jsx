import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import CategoryFilter from './components/CategoryFilter';
import NewsGrid from './components/NewsGrid';
import Analytics from './pages/Analytics';

const CATEGORY_LABELS = {
  all:        '전체',
  world:      '세계',
  technology: '기술',
  business:   '비즈니스',
  science:    '과학',
  health:     '건강',
  sports:     '스포츠',
};

const NAV_TABS = [
  { key: 'news',      label: '📰 뉴스' },
  { key: 'analytics', label: '📊 키워드 분석' },
];

export default function App() {
  const [tab, setTab]               = useState('news');
  const [articles, setArticles]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus]         = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading]       = useState(true);
  const [crawling, setCrawling]     = useState(false);
  const [dark, setDark]             = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const fetchArticles = useCallback(async (category = activeCategory) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/news?category=${category}&limit=80`);
      const { data } = await res.json();
      setArticles(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      const { data } = await res.json();
      setCategories(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      const { data } = await res.json();
      setStatus(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchArticles(activeCategory);
    fetchCategories();
    fetchStatus();
  }, []);

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    fetchArticles(cat);
  };

  const handleCrawl = async () => {
    setCrawling(true);
    await fetch('/api/crawl', { method: 'POST' });
    setTimeout(async () => {
      await Promise.all([fetchArticles(activeCategory), fetchCategories(), fetchStatus()]);
      setCrawling(false);
    }, 5000);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        status={status}
        dark={dark}
        onToggleDark={() => setDark(d => !d)}
        onCrawl={handleCrawl}
        crawling={crawling}
      />

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-0">
          {NAV_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                tab === key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1">
        {tab === 'news' ? (
          <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
            <CategoryFilter
              categories={categories}
              active={activeCategory}
              labels={CATEGORY_LABELS}
              onChange={handleCategoryChange}
            />
            <NewsGrid articles={articles} loading={loading} />
          </div>
        ) : (
          <Analytics />
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 dark:text-gray-600 py-4">
        매일 오전 8시 · 오후 1시 자동 업데이트 &nbsp;|&nbsp; 글로벌 뉴스 대시보드
      </footer>
    </div>
  );
}
