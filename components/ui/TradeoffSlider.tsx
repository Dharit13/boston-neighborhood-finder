interface Props {
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (value: number) => void;
}

export default function TradeoffSlider({
  leftLabel,
  rightLabel,
  value,
  onChange,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span
          className={`${
            value <= 2 ? "text-blue-700 font-medium" : "text-gray-500"
          }`}
        >
          {leftLabel}
        </span>
        <span
          className={`${
            value >= 4 ? "text-blue-700 font-medium" : "text-gray-500"
          }`}
        >
          {rightLabel}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      <div className="flex justify-between text-xs text-gray-400 px-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={value === n ? "text-blue-600 font-bold" : ""}>
            {n === 3 ? "Balanced" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
