// 키워드 워드 클라우드 히트맵
// 빈도가 높을수록 글자가 크고 색이 진함

const COLORS = [
  'text-blue-300 dark:text-blue-700',
  'text-blue-400 dark:text-blue-600',
  'text-blue-500',
  'text-blue-600 dark:text-blue-400',
  'text-blue-700 dark:text-blue-300',
  'text-indigo-600 dark:text-indigo-400',
  'text-violet-600 dark:text-violet-400',
];

export default function WordCloud({ data }) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-600 text-sm">
        데이터가 없습니다
      </div>
    );
  }

  const max = data[0].total;
  const min = data[data.length - 1].total;
  const range = max - min || 1;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2 items-center justify-center p-4 leading-loose select-none">
      {data.map(({ keyword, total }) => {
        const ratio = (total - min) / range;           // 0~1
        const fontSize = Math.round(12 + ratio * 36);  // 12px ~ 48px
        const colorIdx = Math.floor(ratio * (COLORS.length - 1));
        const color = COLORS[colorIdx];
        const weight = ratio > 0.6 ? 'font-bold' : ratio > 0.3 ? 'font-semibold' : 'font-normal';

        return (
          <span
            key={keyword}
            title={`${keyword}: ${total}회`}
            className={`cursor-default transition-transform hover:scale-110 ${color} ${weight}`}
            style={{ fontSize }}
          >
            {keyword}
          </span>
        );
      })}
    </div>
  );
}
