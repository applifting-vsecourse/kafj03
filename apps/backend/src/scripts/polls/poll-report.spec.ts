import { parseLaunchTime } from './poll-report';

describe('poll report launch time', () => {
  it('accepts an explicit UTC timestamp', () => {
    expect(parseLaunchTime('2026-10-13T10:00:00Z').toISOString()).toBe(
      '2026-10-13T10:00:00.000Z',
    );
  });
  it.each([
    undefined,
    '',
    '2026-10-13',
    '2026-10-13T10:00:00',
    '2026-02-30T10:00:00Z',
    '2026-10-13T25:00:00Z',
  ])('rejects an ambiguous or invalid timestamp: %s', (value) => {
    expect(() => parseLaunchTime(value)).toThrow();
  });
});
