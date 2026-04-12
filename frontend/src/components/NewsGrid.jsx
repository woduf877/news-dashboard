import NewsCard from './NewsCard';

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="h-4 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
      <div className="space-y-2 mb-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
      </div>
      <div className="space-y-1 mt-3">
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full" />
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
      </div>
    </div>
  );
}

export default function NewsGrid({ articles, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!articles.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-600">
        <span className="text-6xl mb-4">📭</span>
        <p className="text-lg font-medium">기사가 없습니다</p>
        <p className="text-sm mt-1">상단의 "지금 수집" 버튼으로 뉴스를 가져와보세요.</p>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-gray-400 dark:text-gray-600 mb-4">
        총 <strong className="text-gray-600 dark:text-gray-400">{articles.length.toLocaleString()}</strong>건
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {articles.map((article) => (
          <NewsCard key={article.id} article={article} />
        ))}
      </div>
    </>
  );
}
