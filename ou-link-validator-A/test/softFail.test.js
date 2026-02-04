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

  test("detects full MyLearn not-found phrase", () => {
    const body = "WE COULDN’T FIND THE RESOURCE YOU’RE LOOKING FOR."; // uppercase + curly quotes
    const compiled = compileMarkers([
      "we couldn't find the resource you're looking for",
      "we couldn't find the resource",
    ]);
    expect(findSoftFailMarker(body, compiled)).toBe("we couldn't find the resource you're looking for");
  });

  test("detects retired/obsolete phrasing", () => {
    const body = "The course you're looking for may already be retired or obsolete";
    const compiled = compileMarkers([
      "the course you're looking for may already be retired or obsolete",
      "retired or obsolete",
    ]);
    expect(findSoftFailMarker(body, compiled)).toBe("the course you're looking for may already be retired or obsolete");
  });
});
