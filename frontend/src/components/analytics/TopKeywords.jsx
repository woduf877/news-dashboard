import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';

const PERIOD_LABELS = { daily: '오늘', weekly: '이번 주', monthly: '이번 달' };
const BAR_COLORS = [
  '#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe',
  '#818cf8','#a78bfa','#c4b5fd','#ddd6fe','#ede9fe',
];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { keyword, total } = payload[0].payload;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow text-xs">
      <p className="font-semibold text-gray-900 dark:text-white">{keyword}</p>
      <p className="text-blue-600 dark:text-blue-400">{total.toLocaleString()}회 언급</p>
    </div>
  );
}

export default function TopKeywords({ data, period, onPeriodChange }) {
  const chartData = (data || []).map((d, i) => ({ ...d, rank: i + 1 }));

  return (
    <div className="h-full flex flex-col">
      {/* 기간 탭 */}
      <div className="flex gap-1 mb-4">
        {Object.entries(PERIOD_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => onPeriodChange(key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              period === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!chartData.length ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
          데이터가 없습니다
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              dataKey="keyword"
              type="category"
              width={80}
              tick={{ fontSize: 12, fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
              <LabelList dataKey="total" position="right" style={{ fontSize: 11, fill: '#6b7280' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
