import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import CategoryFilter from './components/CategoryFilter';
import NewsGrid from './components/NewsGrid';

const CATEGORY_LABELS = {
  all:        '전체',
  world:      '세계',
  technology: '기술',
  business:   '비즈니스',
  science:    '과학',
  health:     '건강',
  sports:     '스포츠',
};

export default function App() {
  const [articles, setArticles]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus]         = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading]       = useState(true);
  const [crawling, setCrawling]     = useState(false);
  const [dark, setDark]             = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // 다크모드 적용
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // 기사 불러오기
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

  // 카테고리 불러오기
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      const { data } = await res.json();
      setCategories(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 상태 불러오기
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      const { data } = await res.json();
      setStatus(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    fetchArticles(activeCategory);
    fetchCategories();
    fetchStatus();
  }, []);

  // 카테고리 변경
  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    fetchArticles(cat);
  };

  // 수동 크롤
  const handleCrawl = async () => {
    setCrawling(true);
    await fetch('/api/crawl', { method: 'POST' });
    // 5초 후 데이터 갱신
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

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <CategoryFilter
          categories={categories}
          active={activeCategory}
          labels={CATEGORY_LABELS}
          onChange={handleCategoryChange}
        />

        <NewsGrid
          articles={articles}
          loading={loading}
          category={activeCategory}
        />
      </main>

      <footer className="text-center text-xs text-gray-400 dark:text-gray-600 py-4">
        매일 오전 8시 · 오후 1시 자동 업데이트 &nbsp;|&nbsp; 글로벌 뉴스 대시보드
      </footer>
    </div>
  );
}
