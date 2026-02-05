import { normalizeUrl, isOffHost, includesBadAuthPart } from "../src/url.js";

describe("url utils", () => {
  test("normalizeUrl forces https", () => {
    expect(normalizeUrl("http://mylearn.oracle.com/ou/course/1")).toMatch(/^https:\/\//);
  });

  test("normalizeUrl returns original string on parse failure", () => {
    const bad = normalizeUrl("::not-a-url::");
    expect(typeof bad).toBe("string");
    expect(bad).toContain("::not-a-url::");
  });

  test("isOffHost happy path and invalid url handling", () => {
    expect(isOffHost("https://mylearn.oracle.com/ou/course/1", "mylearn.oracle.com")).toBe(false);
    expect(isOffHost("https://example.com/x", "mylearn.oracle.com")).toBe(true);
    // invalid URL should be handled safely and return false
    expect(isOffHost("::not-a-url::", "mylearn.oracle.com")).toBe(false);
  });

  test("includesBadAuthPart covers case-insensitivity and nulls", () => {
    expect(includesBadAuthPart("https://mylearn.oracle.com/login", ["/login"]))
      .toBe(true);
    expect(includesBadAuthPart("https://mylearn.oracle.com/SSO/redirect", ["/sso"]))
      .toBe(true); // case-insensitive
    expect(includesBadAuthPart("https://mylearn.oracle.com/ou/course/1", ["/login"]))
      .toBe(false);
    // guard paths
    expect(includesBadAuthPart(null, ["/login"]))
      .toBe(false);
    expect(includesBadAuthPart("https://mylearn.oracle.com", null))
      .toBe(false);
  });
});
