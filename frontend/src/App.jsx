import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Market from './pages/Market';
import StockData from './pages/StockData';

const NAV_TABS = [
  { key: 'stock_data',  label: '📋 주가 데이터' },
  { key: 'korea_market', label: '🇰🇷 한국 증시' },
  { key: 'us_market',   label: '🇺🇸 미국 증시' },
];

export default function App() {
  const [tab, setTab]               = useState('stock_data');
  const [status, setStatus]         = useState(null);
  const [crawling, setCrawling]     = useState(false);
  const [dark, setDark]             = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

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
    fetchStatus();
  }, [fetchStatus]);

  const handleCrawl = async () => {
    setCrawling(true);
    await fetch('/api/crawl', { method: 'POST' });
    setTimeout(async () => {
      await fetchStatus();
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
        {tab === 'stock_data' ? (
          <StockData />
        ) : tab === 'korea_market' ? (
          <Market marketFilter="korea" />
        ) : (
          <Market marketFilter="us" />
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 dark:text-gray-600 py-4">
        매일 오전 8시 · 오후 1시 증시 뉴스 백데이터 업데이트 &nbsp;|&nbsp; 18:30 주가 수급 자동 수집
      </footer>
    </div>
  );
}
