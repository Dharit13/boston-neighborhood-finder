import { renderUserCountLabel } from "@/lib/userCount";

export default function UserCount({ count }: { count: number | null }) {
  const label = renderUserCountLabel(count);
  if (!label) return null;
  return (
    <p className="text-xs text-white text-center mt-6">{label}</p>
  );
}
