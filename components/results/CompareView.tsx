import type { ScoredNeighborhood, MbtaLine } from "@/lib/types";

interface Props {
  items: ScoredNeighborhood[];
  monthlyIncome: number;
  onRemove: (id: string) => void;
}

const MBTA_LABELS: Record<MbtaLine, string> = {
  red: "Red",
  green: "Green",
  blue: "Blue",
  orange: "Orange",
  silver: "Silver",
  bus: "Bus",
  ferry: "Ferry",
};

function CellHighlight({
  values,
  index,
  higherIsBetter,
}: {
  values: (number | null)[];
  index: number;
  higherIsBetter: boolean;
}) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return null;
  const best = higherIsBetter ? Math.max(...nums) : Math.min(...nums);
  if (values[index] === best) {
    return (
      <span className="ml-1 text-xs text-green-600 font-medium">Best</span>
    );
  }
  return null;
}

export default function CompareView({ items, monthlyIncome, onRemove }: Props) {
  if (items.length < 2) return null;

  const rows: {
    label: string;
    values: (string | number)[];
    rawValues?: (number | null)[];
    higherIsBetter?: boolean;
  }[] = [
    {
      label: "Match Score",
      values: items.map((i) => `${Math.round(i.matchScore)}%`),
      rawValues: items.map((i) => i.matchScore),
      higherIsBetter: true,
    },
    {
      label: "Rent (per person)",
      values: items.map((i) => `$${i.perPersonRent.toLocaleString()}/mo`),
      rawValues: items.map((i) => i.perPersonRent),
      higherIsBetter: false,
    },
    {
      label: "% of Income",
      values: items.map((i) => `${i.rentPercent}%`),
      rawValues: items.map((i) => i.rentPercent),
      higherIsBetter: false,
    },
    {
      label: "Commute",
      values: items.map((i) =>
        i.commuteMinutes !== null ? `${i.commuteMinutes} min` : "N/A"
      ),
      rawValues: items.map((i) => i.commuteMinutes),
      higherIsBetter: false,
    },
    {
      label: "Safety",
      values: items.map((i) => `${i.scores.safety}/100`),
      rawValues: items.map((i) => i.scores.safety),
      higherIsBetter: true,
    },
    {
      label: "Walk Score",
      values: items.map((i) => `${i.neighborhood.walkScore}`),
      rawValues: items.map((i) => i.neighborhood.walkScore),
      higherIsBetter: true,
    },
    {
      label: "Transit Score",
      values: items.map((i) => `${i.neighborhood.transitScore}`),
      rawValues: items.map((i) => i.neighborhood.transitScore),
      higherIsBetter: true,
    },
    {
      label: "Community",
      values: items.map((i) => `${i.scores.community}/100`),
      rawValues: items.map((i) => i.scores.community),
      higherIsBetter: true,
    },
    {
      label: "MBTA Lines",
      values: items.map((i) =>
        i.neighborhood.mbtaLines.map((l) => MBTA_LABELS[l]).join(", ")
      ),
    },
    {
      label: "Parking Cost",
      values: items.map((i) =>
        i.neighborhood.parkingCost > 0
          ? `$${i.neighborhood.parkingCost}/mo`
          : "Free"
      ),
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Compare Neighborhoods
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 text-gray-500 font-normal w-36">
                &nbsp;
              </th>
              {items.map((item) => (
                <th
                  key={item.neighborhood.id}
                  className="text-left py-2 px-3 font-semibold text-gray-900"
                >
                  <div className="flex items-center justify-between">
                    {item.neighborhood.name}
                    <button
                      onClick={() => onRemove(item.neighborhood.id)}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                    >
                      &times;
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-gray-100">
                <td className="py-2 pr-4 text-gray-600">{row.label}</td>
                {row.values.map((value, idx) => (
                  <td key={idx} className="py-2 px-3 font-medium text-gray-900">
                    {value}
                    {row.rawValues && row.higherIsBetter !== undefined && (
                      <CellHighlight
                        values={row.rawValues}
                        index={idx}
                        higherIsBetter={row.higherIsBetter}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
