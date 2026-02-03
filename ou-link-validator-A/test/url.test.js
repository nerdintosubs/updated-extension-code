import { normalizeUrl, isOffHost, includesBadAuthPart } from "../src/url.js";

describe("url utils", () => {
  test("normalizeUrl forces https", () => {
    expect(normalizeUrl("http://mylearn.oracle.com/ou/course/1")).toMatch(/^https:\/\//);
  });

  test("isOffHost", () => {
    expect(isOffHost("https://mylearn.oracle.com/ou/course/1", "mylearn.oracle.com")).toBe(false);
    expect(isOffHost("https://example.com/x", "mylearn.oracle.com")).toBe(true);
  });

  test("includesBadAuthPart", () => {
    expect(includesBadAuthPart("https://mylearn.oracle.com/login", ["/login"])).toBe(true);
    expect(includesBadAuthPart("https://mylearn.oracle.com/ou/course/1", ["/login"])).toBe(false);
  });
});
