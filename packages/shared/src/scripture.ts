/** Canonical book list with common abbreviations, used by scripture reference detection and Bible search. */
export interface BibleBook {
  name: string;
  testament: 'OT' | 'NT';
  chapters: number;
  aliases: string[];
}

export const BIBLE_BOOKS: BibleBook[] = [
  { name: 'Genesis', testament: 'OT', chapters: 50, aliases: ['gen', 'ge', 'gn'] },
  { name: 'Exodus', testament: 'OT', chapters: 40, aliases: ['exo', 'ex'] },
  { name: 'Leviticus', testament: 'OT', chapters: 27, aliases: ['lev', 'lv'] },
  { name: 'Numbers', testament: 'OT', chapters: 36, aliases: ['num', 'nm'] },
  { name: 'Deuteronomy', testament: 'OT', chapters: 34, aliases: ['deut', 'dt'] },
  { name: 'Joshua', testament: 'OT', chapters: 24, aliases: ['josh', 'jos'] },
  { name: 'Judges', testament: 'OT', chapters: 21, aliases: ['judg', 'jdg'] },
  { name: 'Ruth', testament: 'OT', chapters: 4, aliases: ['rth'] },
  { name: '1 Samuel', testament: 'OT', chapters: 31, aliases: ['1 sam', '1sa', 'i samuel'] },
  { name: '2 Samuel', testament: 'OT', chapters: 24, aliases: ['2 sam', '2sa', 'ii samuel'] },
  { name: '1 Kings', testament: 'OT', chapters: 22, aliases: ['1 kgs', '1ki'] },
  { name: '2 Kings', testament: 'OT', chapters: 25, aliases: ['2 kgs', '2ki'] },
  { name: '1 Chronicles', testament: 'OT', chapters: 29, aliases: ['1 chr', '1ch'] },
  { name: '2 Chronicles', testament: 'OT', chapters: 36, aliases: ['2 chr', '2ch'] },
  { name: 'Ezra', testament: 'OT', chapters: 10, aliases: ['ezr'] },
  { name: 'Nehemiah', testament: 'OT', chapters: 13, aliases: ['neh'] },
  { name: 'Esther', testament: 'OT', chapters: 10, aliases: ['est'] },
  { name: 'Job', testament: 'OT', chapters: 42, aliases: ['jb'] },
  { name: 'Psalms', testament: 'OT', chapters: 150, aliases: ['ps', 'psa', 'psalm'] },
  { name: 'Proverbs', testament: 'OT', chapters: 31, aliases: ['prov', 'pr', 'prv'] },
  { name: 'Ecclesiastes', testament: 'OT', chapters: 12, aliases: ['eccl', 'ecc'] },
  { name: 'Song of Solomon', testament: 'OT', chapters: 8, aliases: ['song', 'sos', 'canticles'] },
  { name: 'Isaiah', testament: 'OT', chapters: 66, aliases: ['isa', 'is'] },
  { name: 'Jeremiah', testament: 'OT', chapters: 52, aliases: ['jer'] },
  { name: 'Lamentations', testament: 'OT', chapters: 5, aliases: ['lam'] },
  { name: 'Ezekiel', testament: 'OT', chapters: 48, aliases: ['ezek', 'eze'] },
  { name: 'Daniel', testament: 'OT', chapters: 12, aliases: ['dan', 'dn'] },
  { name: 'Hosea', testament: 'OT', chapters: 14, aliases: ['hos'] },
  { name: 'Joel', testament: 'OT', chapters: 3, aliases: ['jol'] },
  { name: 'Amos', testament: 'OT', chapters: 9, aliases: ['am'] },
  { name: 'Obadiah', testament: 'OT', chapters: 1, aliases: ['obad', 'ob'] },
  { name: 'Jonah', testament: 'OT', chapters: 4, aliases: ['jon'] },
  { name: 'Micah', testament: 'OT', chapters: 7, aliases: ['mic'] },
  { name: 'Nahum', testament: 'OT', chapters: 3, aliases: ['nah'] },
  { name: 'Habakkuk', testament: 'OT', chapters: 3, aliases: ['hab'] },
  { name: 'Zephaniah', testament: 'OT', chapters: 3, aliases: ['zeph', 'zep'] },
  { name: 'Haggai', testament: 'OT', chapters: 2, aliases: ['hag'] },
  { name: 'Zechariah', testament: 'OT', chapters: 14, aliases: ['zech', 'zec'] },
  { name: 'Malachi', testament: 'OT', chapters: 4, aliases: ['mal'] },
  { name: 'Matthew', testament: 'NT', chapters: 28, aliases: ['matt', 'mt'] },
  { name: 'Mark', testament: 'NT', chapters: 16, aliases: ['mk', 'mrk'] },
  { name: 'Luke', testament: 'NT', chapters: 24, aliases: ['lk', 'luk'] },
  { name: 'John', testament: 'NT', chapters: 21, aliases: ['jn', 'joh'] },
  { name: 'Acts', testament: 'NT', chapters: 28, aliases: ['act'] },
  { name: 'Romans', testament: 'NT', chapters: 16, aliases: ['rom', 'rm'] },
  { name: '1 Corinthians', testament: 'NT', chapters: 16, aliases: ['1 cor', '1co'] },
  { name: '2 Corinthians', testament: 'NT', chapters: 13, aliases: ['2 cor', '2co'] },
  { name: 'Galatians', testament: 'NT', chapters: 6, aliases: ['gal'] },
  { name: 'Ephesians', testament: 'NT', chapters: 6, aliases: ['eph'] },
  { name: 'Philippians', testament: 'NT', chapters: 4, aliases: ['phil', 'php'] },
  { name: 'Colossians', testament: 'NT', chapters: 4, aliases: ['col'] },
  { name: '1 Thessalonians', testament: 'NT', chapters: 5, aliases: ['1 thess', '1th'] },
  { name: '2 Thessalonians', testament: 'NT', chapters: 3, aliases: ['2 thess', '2th'] },
  { name: '1 Timothy', testament: 'NT', chapters: 6, aliases: ['1 tim', '1ti'] },
  { name: '2 Timothy', testament: 'NT', chapters: 4, aliases: ['2 tim', '2ti'] },
  { name: 'Titus', testament: 'NT', chapters: 3, aliases: ['tit'] },
  { name: 'Philemon', testament: 'NT', chapters: 1, aliases: ['phlm', 'phm'] },
  { name: 'Hebrews', testament: 'NT', chapters: 13, aliases: ['heb'] },
  { name: 'James', testament: 'NT', chapters: 5, aliases: ['jas', 'jm'] },
  { name: '1 Peter', testament: 'NT', chapters: 5, aliases: ['1 pet', '1pe'] },
  { name: '2 Peter', testament: 'NT', chapters: 3, aliases: ['2 pet', '2pe'] },
  { name: '1 John', testament: 'NT', chapters: 5, aliases: ['1 jn', '1jo'] },
  { name: '2 John', testament: 'NT', chapters: 1, aliases: ['2 jn', '2jo'] },
  { name: '3 John', testament: 'NT', chapters: 1, aliases: ['3 jn', '3jo'] },
  { name: 'Jude', testament: 'NT', chapters: 1, aliases: ['jud'] },
  { name: 'Revelation', testament: 'NT', chapters: 22, aliases: ['rev', 'apocalypse'] },
];

const BOOK_LOOKUP = new Map<string, BibleBook>();
for (const book of BIBLE_BOOKS) {
  BOOK_LOOKUP.set(book.name.toLowerCase(), book);
  for (const alias of book.aliases) BOOK_LOOKUP.set(alias, book);
}

export function findBook(token: string): BibleBook | undefined {
  return BOOK_LOOKUP.get(token.trim().toLowerCase().replace(/\.$/, ''));
}

export interface ScriptureReference {
  book: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
  raw: string;
}

const REFERENCE_PATTERN =
  /\b((?:[1-3]\s?)?[A-Za-z]{2,}(?:\s+of\s+[A-Za-z]+)?)\.?\s+(\d{1,3})(?::(\d{1,3})(?:\s?[-–]\s?(\d{1,3}))?)?\b/g;

/** Pulls "Romans 8:28", "1 Cor 13", "Psalm 23:1-6" out of free text. */
export function extractScriptureReferences(text: string): ScriptureReference[] {
  const found: ScriptureReference[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(REFERENCE_PATTERN)) {
    const book = findBook(match[1]);
    if (!book) continue;
    const chapter = Number(match[2]);
    if (chapter < 1 || chapter > book.chapters) continue;
    const ref: ScriptureReference = {
      book: book.name,
      chapter,
      verseStart: match[3] ? Number(match[3]) : undefined,
      verseEnd: match[4] ? Number(match[4]) : undefined,
      raw: match[0].trim(),
    };
    const key = `${ref.book} ${ref.chapter}:${ref.verseStart ?? ''}-${ref.verseEnd ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(ref);
  }
  return found;
}

export function formatReference(ref: ScriptureReference): string {
  let out = `${ref.book} ${ref.chapter}`;
  if (ref.verseStart) out += `:${ref.verseStart}`;
  if (ref.verseEnd) out += `-${ref.verseEnd}`;
  return out;
}
