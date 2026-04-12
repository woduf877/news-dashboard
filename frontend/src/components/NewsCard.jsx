const CATEGORY_COLORS = {
  world:      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  technology: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  business:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  science:    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  health:     'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  sports:     'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};

const CATEGORY_LABELS = {
  world: '세계', technology: '기술', business: '비즈니스',
  science: '과학', health: '건강', sports: '스포츠',
};

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function NewsCard({ article }) {
  const { title, description, link, pub_date, source_name, category } = article;

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 card-hover cursor-pointer"
    >
      {/* 카테고리 + 출처 */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-600'}`}>
          {CATEGORY_LABELS[category] || category}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[120px]" title={source_name}>
          {source_name}
        </span>
      </div>

      {/* 제목 */}
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug mb-2 line-clamp-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {title}
      </h2>

      {/* 요약 */}
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3 flex-1">
          {description}
        </p>
      )}

      {/* 시간 */}
      <div className="flex items-center gap-1 mt-3 text-xs text-gray-400 dark:text-gray-600">
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {timeAgo(pub_date)}
      </div>
    </a>
  );
}
