import {
  mapLinesToRoutes,
  filterAndNormalizeAlerts,
} from "@/lib/mbtaAlerts";

describe("mapLinesToRoutes", () => {
  it("maps basic heavy rail lines", () => {
    expect(mapLinesToRoutes(["red", "orange", "blue"])).toEqual([
      "Red",
      "Orange",
      "Blue",
    ]);
  });

  it("expands green to all four branches", () => {
    expect(mapLinesToRoutes(["green"])).toEqual([
      "Green-B",
      "Green-C",
      "Green-D",
      "Green-E",
    ]);
  });

  it("expands silver to SL bus routes", () => {
    expect(mapLinesToRoutes(["silver"])).toEqual([
      "741",
      "742",
      "743",
      "746",
      "749",
      "751",
    ]);
  });

  it("skips bus and ferry", () => {
    expect(mapLinesToRoutes(["bus", "ferry"])).toEqual([]);
    expect(mapLinesToRoutes(["red", "bus"])).toEqual(["Red"]);
  });

  it("returns empty for empty input", () => {
    expect(mapLinesToRoutes([])).toEqual([]);
  });

  it("combines multiple lines", () => {
    expect(mapLinesToRoutes(["red", "green"])).toEqual([
      "Red",
      "Green-B",
      "Green-C",
      "Green-D",
      "Green-E",
    ]);
  });
});

const makeRaw = (alerts: Array<Record<string, unknown>>) => ({
  data: alerts.map((a, i) => ({
    id: (a.id as string) ?? `alert-${i}`,
    type: "alert",
    attributes: {
      header: a.header ?? "Header",
      description: a.description ?? "Description",
      severity: a.severity ?? 5,
      effect: a.effect ?? "DELAY",
      url: a.url ?? null,
      informed_entity: a.informed_entity ?? [{ route: "Red" }],
    },
  })),
});

describe("filterAndNormalizeAlerts", () => {
  it("maps a basic alert", () => {
    const raw = makeRaw([
      {
        id: "a1",
        header: "Red Line delays",
        description: "Signal problem near JFK",
        severity: 7,
        effect: "DELAY",
        url: "https://www.mbta.com/alerts/a1",
        informed_entity: [{ route: "Red" }],
      },
    ]);
    const result = filterAndNormalizeAlerts(raw, ["red"]);
    expect(result).toEqual([
      {
        id: "a1",
        header: "Red Line delays",
        description: "Signal problem near JFK",
        severity: 7,
        effect: "DELAY",
        routes: ["red"],
        url: "https://www.mbta.com/alerts/a1",
      },
    ]);
  });

  it("drops alerts with excluded effects", () => {
    const raw = makeRaw([
      { id: "a1", effect: "DELAY" },
      { id: "a2", effect: "ELEVATOR_CLOSURE" },
      { id: "a3", effect: "ESCALATOR_CLOSURE" },
      { id: "a4", effect: "ACCESS_ISSUE" },
      { id: "a5", effect: "FACILITY_ISSUE" },
      { id: "a6", effect: "OTHER_EFFECT" },
      { id: "a7", effect: "DETOUR" },
    ]);
    const result = filterAndNormalizeAlerts(raw, ["red"]);
    expect(result.map((a) => a.id)).toEqual(["a1", "a7"]);
  });

  it("sorts by severity descending", () => {
    const raw = makeRaw([
      { id: "a1", severity: 3 },
      { id: "a2", severity: 9 },
      { id: "a3", severity: 6 },
    ]);
    const result = filterAndNormalizeAlerts(raw, ["red"]);
    expect(result.map((a) => a.id)).toEqual(["a2", "a3", "a1"]);
  });

  it("caps at 10 alerts", () => {
    const raw = makeRaw(
      Array.from({ length: 15 }, (_, i) => ({ id: `a${i}`, severity: 5 }))
    );
    const result = filterAndNormalizeAlerts(raw, ["red"]);
    expect(result).toHaveLength(10);
  });

  it("reverse-maps Green branches to green", () => {
    const raw = makeRaw([
      {
        id: "a1",
        informed_entity: [
          { route: "Green-B" },
          { route: "Green-C" },
        ],
      },
    ]);
    const result = filterAndNormalizeAlerts(raw, ["green"]);
    expect(result[0].routes).toEqual(["green"]);
  });

  it("reverse-maps silver bus routes to silver", () => {
    const raw = makeRaw([
      { id: "a1", informed_entity: [{ route: "741" }, { route: "749" }] },
    ]);
    const result = filterAndNormalizeAlerts(raw, ["silver"]);
    expect(result[0].routes).toEqual(["silver"]);
  });

  it("only includes requested lines in routes output", () => {
    // Alert touches Red and Orange but caller only asked for red
    const raw = makeRaw([
      {
        id: "a1",
        informed_entity: [{ route: "Red" }, { route: "Orange" }],
      },
    ]);
    const result = filterAndNormalizeAlerts(raw, ["red"]);
    expect(result[0].routes).toEqual(["red"]);
  });

  it("uses header as fallback when description is missing", () => {
    const raw = {
      data: [
        {
          id: "a1",
          type: "alert",
          attributes: {
            header: "Red Line delays",
            severity: 5,
            effect: "DELAY",
            url: null,
            informed_entity: [{ route: "Red" }],
          },
        },
      ],
    };
    const result = filterAndNormalizeAlerts(raw, ["red"]);
    expect(result[0].description).toBe("Red Line delays");
  });

  it("handles empty response", () => {
    expect(filterAndNormalizeAlerts({ data: [] }, ["red"])).toEqual([]);
  });

  it("handles malformed response", () => {
    expect(filterAndNormalizeAlerts(null, ["red"])).toEqual([]);
    expect(filterAndNormalizeAlerts({}, ["red"])).toEqual([]);
    expect(filterAndNormalizeAlerts({ data: "not array" }, ["red"])).toEqual([]);
  });
});
