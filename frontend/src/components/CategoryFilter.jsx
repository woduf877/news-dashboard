const CATEGORY_ICONS = {
  all:        '🌐',
  world:      '🗺️',
  technology: '💻',
  business:   '📈',
  science:    '🔬',
  health:     '🏥',
  sports:     '⚽',
};

export default function CategoryFilter({ categories, active, labels, onChange }) {
  if (!categories.length) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
      {categories.map(({ category, count }) => {
        const isActive = category === active;
        return (
          <button
            key={category}
            onClick={() => onChange(category)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0
              ${isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/30'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
          >
            <span>{CATEGORY_ICONS[category] || '📄'}</span>
            <span>{labels[category] || category}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-normal ${
              isActive
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}>
              {count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
