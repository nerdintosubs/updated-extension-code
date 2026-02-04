import { csvSanitize } from "../src/csvSanitize.js";

describe("csvSanitize", () => {
  test("returns empty string for null/undefined", () => {
    expect(csvSanitize(null)).toBe("");
    expect(csvSanitize(undefined)).toBe("");
  });

  test("prefixes risky leading characters with a single quote", () => {
    expect(csvSanitize("=1+2")).toBe("'=1+2");
    expect(csvSanitize("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
    expect(csvSanitize("-10")).toBe("'-10");
    expect(csvSanitize("@HYPERLINK(\"x\",\"y\")")).toBe("'@HYPERLINK(\"x\",\"y\")");
  });

  test("passes through safe values", () => {
    expect(csvSanitize("hello")).toBe("hello");
    expect(csvSanitize(123)).toBe("123");
    expect(csvSanitize("(A1)")) .toBe("(A1)");
  });
});
