import { normalizePunctuation, normalizeText } from "../src/textNormalize.js";

describe("textNormalize", () => {
  test("normalizePunctuation converts curly apostrophes to ASCII", () => {
    expect(normalizePunctuation("couldn’t")).toBe("couldn't");
  });

  test("normalizeText lowercases, trims, collapses whitespace", () => {
    expect(normalizeText(" Hello WORLD \n")).toBe("hello world");
  });

  test("normalizeText removes combining marks (NFKD)", () => {
    const s = "Café"; // e + combining acute
    expect(normalizeText(s)).toBe("cafe");
  });
});
