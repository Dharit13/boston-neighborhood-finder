import type { CommuteResult } from "./types";

export async function fetchCommuteTimes(
  origins: { id: string; lat: number; lng: number }[],
  destinationAddress: string
): Promise<Map<string, CommuteResult>> {
  const results = new Map<string, CommuteResult>();

  const batchSize = 5;
  for (let i = 0; i < origins.length; i += batchSize) {
    const batch = origins.slice(i, i + batchSize);
    const promises = batch.map(async (origin) => {
      const res = await fetch("/api/commute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originLat: origin.lat,
          originLng: origin.lng,
          destination: destinationAddress,
        }),
      });
      if (!res.ok) return { id: origin.id, result: null };
      const data: CommuteResult = await res.json();
      return { id: origin.id, result: data };
    });

    const batchResults = await Promise.all(promises);
    for (const { id, result } of batchResults) {
      if (result) results.set(id, result);
    }
  }

  return results;
}
