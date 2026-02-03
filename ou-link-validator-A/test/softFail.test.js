import { compileMarkers, findSoftFailMarker } from "../src/softFail.js";

describe("softFail detection", () => {
  test("findSoftFailMarker matches even with curly apostrophes", () => {
    const body = "We couldn’t find the resource you’re looking for"; // curly apostrophes
    const compiled = compileMarkers(["we couldn't find the resource"]);
    expect(findSoftFailMarker(body, compiled)).toBe("we couldn't find the resource");
  });

  test("findSoftFailMarker returns null when no marker exists", () => {
    const compiled = compileMarkers(["access denied"]);
    expect(findSoftFailMarker("valid course page", compiled)).toBeNull();
  });

  test("compileMarkers preserves raw values", () => {
    const compiled = compileMarkers(["A", "B"]);
    expect(compiled.map(x => x.raw)).toEqual(["A", "B"]);
  });
});
