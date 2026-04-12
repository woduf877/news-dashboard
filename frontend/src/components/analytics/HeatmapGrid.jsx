// 키워드 × 날짜 히트맵 그리드 (GitHub contribution 스타일)

function heatColor(value, max) {
  if (!value || value === 0) return 'bg-gray-100 dark:bg-gray-800';
  const ratio = value / max;
  if (ratio < 0.2)  return 'bg-blue-100 dark:bg-blue-950';
  if (ratio < 0.4)  return 'bg-blue-200 dark:bg-blue-800';
  if (ratio < 0.6)  return 'bg-blue-400 dark:bg-blue-600';
  if (ratio < 0.8)  return 'bg-blue-600 dark:bg-blue-400';
  return              'bg-blue-800 dark:bg-blue-200';
}

function shortDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function HeatmapGrid({ data }) {
  if (!data?.keywords?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-600 text-sm">
        데이터가 없습니다
      </div>
    );
  }

  const { keywords, dates, matrix } = data;

  // 전체 최댓값 (색상 스케일 기준)
  const allValues = keywords.flatMap(kw => dates.map(d => matrix[kw]?.[d] || 0));
  const maxVal = Math.max(...allValues, 1);

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-separate" style={{ borderSpacing: '2px' }}>
        <thead>
          <tr>
            <th className="text-left pr-3 font-medium text-gray-500 dark:text-gray-400 w-28 sticky left-0 bg-white dark:bg-gray-900">
              키워드
            </th>
            {dates.map(d => (
              <th
                key={d}
                className="text-gray-400 dark:text-gray-600 font-normal text-center"
                style={{ minWidth: '32px' }}
              >
                {shortDate(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keywords.map(kw => (
            <tr key={kw}>
              <td className="pr-3 text-gray-700 dark:text-gray-300 font-medium truncate max-w-28 sticky left-0 bg-white dark:bg-gray-900">
                {kw}
              </td>
              {dates.map(d => {
                const val = matrix[kw]?.[d] || 0;
                return (
                  <td key={d} title={`${kw} · ${d}: ${val}회`}>
                    <div
                      className={`rounded-sm h-6 w-8 ${heatColor(val, maxVal)} transition-colors`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 범례 */}
      <div className="flex items-center gap-1 mt-3 text-xs text-gray-400 dark:text-gray-600">
        <span>적음</span>
        {['bg-gray-100 dark:bg-gray-800','bg-blue-100','bg-blue-200','bg-blue-400','bg-blue-600','bg-blue-800'].map((c,i) => (
          <div key={i} className={`h-4 w-6 rounded-sm ${c}`} />
        ))}
        <span>많음</span>
      </div>
    </div>
  );
}
