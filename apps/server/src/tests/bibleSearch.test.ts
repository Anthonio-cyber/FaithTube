import { describe, expect, it } from 'vitest';
import { searchBible } from '../services/bible.service.js';

const refs = async (query: string) => (await searchBible(query)).verses.map((v) => v.reference);

/**
 * These came out of a smoke test against the live site, which answered a
 * question about forgiveness with verses on the tithe.
 */
describe('searchBible topic matching', () => {
  it('does not treat "forgiving" as the topic "giving"', async () => {
    const found = await refs('What does the Bible say about forgiving someone who hurt you?');
    expect(found).toContain('Ephesians 4:32');
    // Cheerful giving and the storehouse tithe are not answers to this question.
    expect(found).not.toContain('2 Corinthians 9:7');
    expect(found).not.toContain('Malachi 3:10');
  });

  it('still matches a question that is actually about giving', async () => {
    const found = await refs('What does Scripture say about giving and money?');
    expect(found.some((r) => r === '2 Corinthians 9:7' || r === 'Malachi 3:10')).toBe(true);
  });

  it('still matches across word endings, which is what the loose check was for', async () => {
    expect(await refs('forgiveness')).toContain('Ephesians 4:32');
    expect((await refs('anxious')).length).toBeGreaterThan(0);
  });

  it('finds a passage named directly', async () => {
    expect(await refs('Philippians 4')).toContain('Philippians 4:6-7');
  });
});
