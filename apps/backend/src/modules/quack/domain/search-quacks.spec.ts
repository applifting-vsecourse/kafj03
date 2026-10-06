import { Quack } from './quack';
import { searchQuacks } from './search-quacks';

const post = (
  id: string,
  text: string,
  name = 'Petr',
  date = '2026-01-01',
): Quack => ({
  id,
  text,
  userId: 'u1',
  createdAt: new Date(date),
  updatedAt: new Date(date),
  user: { id: 'u1', name, username: 'username' },
});

describe('searchQuacks', () => {
  it('ignores case and accents, matches substrings across author and text, and requires every term', () => {
    const matching = post('match', 'Žlutý výlet', 'PÉTR');
    expect(
      searchQuacks([matching, post('other', 'Žlutý den')], '  PET ZLUT VYL  '),
    ).toEqual([matching]);
    expect(searchQuacks([matching], 'Petr missing')).toEqual([]);
  });

  it('ranks phrases before whole words before substrings, with newest first on ties', () => {
    const posts = [
      post('partial', 'yellowish ducks', 'Duck', '2026-04-01'),
      post('words', 'yellow small duck', 'Duck', '2026-03-01'),
      post('old-phrase', 'yellow duck', 'Author', '2026-01-01'),
      post('author-phrase', 'hello', 'Yellow Duck', '2026-02-01'),
    ];
    expect(searchQuacks(posts, 'yellow duck').map((p) => p.id)).toEqual([
      'author-phrase',
      'old-phrase',
      'words',
      'partial',
    ]);
  });

  it('does not rank a substring inside a larger word as an exact phrase', () => {
    const posts = [
      post('partial', 'petra pet', 'Author', '2026-04-01'),
      post('exact', 'pet pet', 'Author'),
    ];
    expect(searchQuacks(posts, 'pet pet').map((p) => p.id)).toEqual([
      'exact',
      'partial',
    ]);
  });

  it('restores the feed for whitespace and treats punctuation literally', () => {
    const posts = [post('a', 'hello [duck]')];
    expect(searchQuacks(posts, '   ')).toBe(posts);
    expect(searchQuacks(posts, '[duck]')).toEqual(posts);
  });
});
