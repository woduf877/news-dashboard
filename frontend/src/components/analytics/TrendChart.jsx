import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

const LINE_COLORS = [
  '#2563eb','#dc2626','#16a34a','#d97706','#7c3aed',
  '#0891b2','#be185d','#65a30d',
];

function shortDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow text-xs max-w-48">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      {payload
        .sort((a, b) => b.value - a.value)
        .map(p => (
          <div key={p.dataKey} className="flex justify-between gap-3">
            <span style={{ color: p.color }}>{p.dataKey}</span>
            <span className="font-medium text-gray-900 dark:text-white">{p.value}회</span>
          </div>
        ))}
    </div>
  );
}

export default function TrendChart({ data }) {
  if (!data?.dates?.length || !data?.keywords?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-600 text-sm">
        데이터가 없습니다
      </div>
    );
  }

  const { keywords, dates, series } = data;

  // recharts용 데이터: [{ date, keyword1: count, keyword2: count, ... }]
  const chartData = dates.map(d => {
    const point = { date: shortDate(d) };
    for (const kw of keywords) {
      point[kw] = series[kw]?.[d] || 0;
    }
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
          iconType="circle"
          iconSize={8}
        />
        {keywords.map((kw, i) => (
          <Line
            key={kw}
            type="monotone"
            dataKey={kw}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
