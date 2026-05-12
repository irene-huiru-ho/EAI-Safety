export default function RatingScale({ label, description, lowLabel, highLabel, value, onChange }) {
  return (
    <div>
      <p className="font-semibold text-gray-900">{label}</p>
      <p className="text-sm text-gray-500 mt-0.5 mb-3">{description}</p>

      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-3 rounded-xl text-lg font-bold border-2 transition-colors
              ${value === n
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-200 text-gray-700 active:bg-gray-50'
              }`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="flex justify-between mt-1 text-xs text-gray-400">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
