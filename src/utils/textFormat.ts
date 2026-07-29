export function normalizeKey(str: string): string {
  return str.trim().toLowerCase();
}

const ACRONYM_RE = /^[A-Z]{2,4}$/;

function capitalizeWord(word: string): string {
  const match = word.match(/^([^a-zA-Z]*)([a-zA-Z]+)([^a-zA-Z]*)$/);
  if (!match) return word;
  const [, prefix, letters, suffix] = match;
  if (ACRONYM_RE.test(letters)) return prefix + letters + suffix;
  const cased = letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
  return prefix + cased + suffix;
}

export function smartTitleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map(capitalizeWord)
    .join(' ');
}
