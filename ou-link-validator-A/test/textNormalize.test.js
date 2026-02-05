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

  test("normalizePunctuation converts smart quotes and dashes", () => {
    expect(normalizePunctuation("“Hello”—World”")).toBe('"Hello"-World"');
  });

  test("normalizePunctuation handles null input (coalesces to empty)", () => {
    expect(normalizePunctuation(null)).toBe("");
  });

  test("normalizeText handles null and collapses tabs/newlines", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText("A\t\tB\nC")).toBe("a b c");
  });
});
