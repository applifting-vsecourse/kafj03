import { Quack } from './quack';

const normalize = (value: string): string =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

export function searchQuacks(quacks: Quack[], query: string): Quack[] {
  const terms = normalize(query).split(/\s+/u).filter(Boolean);
  if (!terms.length) return quacks;
  const phrase = terms.join(' ');
  return quacks
    .map((quack) => {
      const fields = [normalize(quack.text), normalize(quack.user?.name ?? '')];
      const words = fields.flatMap((field) => field.split(/[^\p{L}\p{N}_]+/u));
      const matches = terms.every((term) =>
        fields.some((field) => field.includes(term)),
      );
      const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const phrasePattern = new RegExp(
        `(?<![\\p{L}\\p{N}_])${escapedPhrase}(?![\\p{L}\\p{N}_])`,
        'u',
      );
      const exactPhrase = fields.some((field) =>
        phrasePattern.test(field.replace(/\s+/gu, ' ')),
      );
      const rank = exactPhrase
        ? 0
        : terms.every((term) => words.includes(term))
          ? 1
          : 2;
      return { quack, matches, rank };
    })
    .filter((item) => item.matches)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.quack.createdAt.getTime() - a.quack.createdAt.getTime() ||
        a.quack.id.localeCompare(b.quack.id),
    )
    .map((item) => item.quack);
}
