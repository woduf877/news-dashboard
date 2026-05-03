export default function Header({ status, dark, onToggleDark, onCrawl, crawling }) {
  const fmt = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ko-KR', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const nextCrawl = status?.nextCrawlAt?.[0]
    ? new Date(status.nextCrawlAt[0]).toLocaleString('ko-KR', {
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* 로고 */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-2xl">📈</span>
          <div>
            <h1 className="text-base font-bold leading-none text-gray-900 dark:text-white">
              마켓 대시보드
            </h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 leading-none mt-0.5">
              Stock & Market Intelligence
            </p>
          </div>
        </div>

        {/* 상태 정보 (중간, 큰 화면에서만) */}
        <div className="hidden md:flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
          <span>
            마지막 업데이트&nbsp;
            <strong className="text-gray-700 dark:text-gray-300">{fmt(status?.lastCrawlAt)}</strong>
          </span>
          <span>
            다음 업데이트&nbsp;
            <strong className="text-gray-700 dark:text-gray-300">{nextCrawl}</strong>
          </span>
          <span>
            소스&nbsp;
            <strong className="text-gray-700 dark:text-gray-300">{status?.sources ?? '—'}개</strong>
          </span>
        </div>

        {/* 우측 버튼 */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCrawl}
            disabled={crawling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
          >
            {crawling ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                크롤 중…
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                뉴스 수집
              </>
            )}
          </button>

          {/* 다크모드 토글 */}
          <button
            onClick={onToggleDark}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
            title={dark ? '라이트 모드' : '다크 모드'}
          >
            {dark ? (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
