// Age heuristics — mirrors scraper/scrape.py::_AGE_REGEX
const NEW_PATTERNS = [
  /\bجديد(?:ة|ه)?\b/,
  /أقل\s*من\s*2\s*سن/,
  /عمر\s*العقار\s*[:\-]?\s*(?:0|1|2)\s*سن/,
  /\b0\s*سن/, /\b1\s*سن/, /\b2\s*سن/,
  /\bتحت\s*الانشاء/, /\bتحت\s*الإنشاء/,
];

export function looksNew(text: string | null | undefined): boolean {
  if (!text) return false;
  return NEW_PATTERNS.some((re) => re.test(text));
}
