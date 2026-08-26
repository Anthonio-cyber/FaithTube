/**
 * Lexicons for the on-device Christian-content and safety classifiers.
 *
 * These power the `heuristic` moderation provider, which is the default so the
 * platform is fully functional with no third-party AI key. When ANTHROPIC_API_KEY
 * is present the Claude provider runs instead and these lexicons are still used
 * as a cheap pre-filter and as a sanity check on the model's answer.
 *
 * Weights are deliberate:
 *  - `strong` terms are hard to use outside a Christian context.
 *  - `moderate` terms are typical of Christian material but appear elsewhere.
 *  - `weak` terms only count when other signals are already present.
 */
export interface WeightedTerm {
  term: string;
  weight: number;
}

function terms(weight: number, list: string[]): WeightedTerm[] {
  return list.map((term) => ({ term, weight }));
}

export const CHRISTIAN_TERMS: WeightedTerm[] = [
  ...terms(3.0, [
    'jesus christ',
    'lord jesus',
    'the gospel',
    'holy spirit',
    'the cross of christ',
    'god the father',
    'our savior',
    'our saviour',
    'born again',
    'the word of god',
    'crucifixion',
    'resurrection of jesus',
    'kingdom of god',
    'kingdom of heaven',
    'body of christ',
    'great commission',
    'communion',
    'the lord’s supper',
    "the lord's supper",
    'baptism',
    'sanctification',
    'justification by faith',
    'atonement',
    'redemption in christ',
    'trinity',
    'incarnation',
    'second coming',
  ]),
  ...terms(2.2, [
    'jesus',
    'christ',
    'gospel',
    'scripture',
    'bible',
    'biblical',
    'sermon',
    'preaching',
    'preacher',
    'pastor',
    'discipleship',
    'evangelism',
    'evangelist',
    'testimony',
    'salvation',
    'repentance',
    'grace of god',
    'worship service',
    'praise and worship',
    'prayer meeting',
    'intercession',
    'congregation',
    'ministry',
    'missionary',
    'apostle',
    'epistle',
    'psalm',
    'proverb',
    'parable',
    'covenant',
    'messiah',
    'saviour',
    'savior',
    'calvary',
    'golgotha',
    'pentecost',
    'revival',
    'church service',
    'sunday service',
    'bible study',
    'devotional',
    'theology',
    'doctrine',
    'apologetics',
    'hymn',
  ]),
  ...terms(1.3, [
    'faith',
    'god',
    'lord',
    'prayer',
    'pray',
    'worship',
    'church',
    'holy',
    'blessing',
    'blessed',
    'righteousness',
    'sin',
    'forgiveness',
    'mercy',
    'grace',
    'heaven',
    'eternal life',
    'spiritual',
    'believer',
    'christian',
    'disciple',
    'fellowship',
    'anointing',
    'shepherd',
    'flock',
    'amen',
    'hallelujah',
    'praise',
    'glory to god',
    'saints',
    'chapel',
    'cathedral',
    'parish',
    'seminary',
    'catechism',
    'liturgy',
  ]),
  ...terms(0.6, [
    'hope',
    'love one another',
    'humility',
    'obedience',
    'sacrifice',
    'temple',
    'altar',
    'fasting',
    'vision',
    'calling',
    'purpose',
    'family devotion',
    'marriage in christ',
  ]),
];

/**
 * Markers of material that is *presented* as content but is plainly not
 * Christ-centred. These reduce the relevance score rather than rejecting
 * outright — a sermon can legitimately quote or critique any of them.
 */
export const NON_CHRISTIAN_MARKERS: WeightedTerm[] = [
  ...terms(2.5, [
    'full movie hd',
    'official music video',
    'gameplay walkthrough',
    'reaction video',
    'unboxing',
    'makeup tutorial',
    'crypto signals',
    'forex signals',
    'get rich quick',
    'onlyfans',
    'casino bonus',
    'sports betting',
    'free robux',
    'free v bucks',
    'nude',
    'nsfw',
    'twerk',
    'diss track',
  ]),
  ...terms(1.4, [
    'horoscope',
    'zodiac reading',
    'tarot',
    'psychic reading',
    'astrology forecast',
    'manifest your desires',
    'law of attraction',
    'spell casting',
    'occult ritual',
    'summoning',
    'ouija',
  ]),
  ...terms(1.0, ['prank', 'trending challenge', 'celebrity gossip', 'drama channel', 'exposed video']),
];

/**
 * Content that attacks Christian faith or persons. Note the distinction the
 * platform policy requires: honest apologetics and answering objections is
 * allowed and even encouraged, so these terms only score when they are not
 * accompanied by apologetic framing (handled in the classifier).
 */
export const ANTI_CHRISTIAN_MARKERS: WeightedTerm[] = [
  ...terms(3.0, [
    'christianity is a lie',
    'the bible is fake',
    'jesus never existed',
    'debunking christianity',
    'why i left christianity forever',
    'religion is poison',
    'destroy christianity',
    'mock jesus',
    'blaspheming christ',
  ]),
  ...terms(1.5, ['anti-christian', 'atheist rebuttal to god', 'against the gospel']),
];

/** Apologetic framing that legitimises discussing objections to the faith. */
export const APOLOGETIC_FRAMING: string[] = [
  'apologetics',
  'answering objections',
  'defending the faith',
  'responding to',
  'refuting',
  'a christian response',
  'biblical answer',
  'how to answer',
  'engaging with',
  'giving an answer',
  '1 peter 3:15',
];

export const SEXUAL_TERMS: WeightedTerm[] = [
  ...terms(3.0, ['porn', 'pornographic', 'xxx', 'explicit sex', 'nude scene', 'sex tape', 'erotic', 'camgirl']),
  ...terms(1.2, ['sexy', 'seductive', 'lingerie', 'strip', 'hookup']),
];

export const VIOLENCE_TERMS: WeightedTerm[] = [
  ...terms(3.0, ['graphic execution', 'beheading', 'gore compilation', 'torture video', 'shooting footage', 'brutal killing']),
  ...terms(1.0, ['fight compilation', 'bloody', 'massacre', 'gruesome']),
];

export const HATE_TERMS: WeightedTerm[] = [
  ...terms(3.0, [
    'ethnic cleansing',
    'racial slur',
    'kill all',
    'exterminate them',
    'subhuman',
    'white power',
    'gas the',
    'deserve to die',
  ]),
  ...terms(1.5, ['hate group', 'supremacist', 'they are vermin', 'inferior race']),
];

export const DANGEROUS_TERMS: WeightedTerm[] = [
  ...terms(3.0, [
    'how to make a bomb',
    'build a weapon at home',
    'suicide method',
    'stop taking your medication',
    'drink bleach',
    'refuse medical treatment for your child',
    'poison recipe',
  ]),
  ...terms(1.5, ['dangerous challenge', 'do not seek medical help']),
];

/** Fraudulent religious claims and financial exploitation dressed as ministry. */
export const SCAM_TERMS: WeightedTerm[] = [
  ...terms(3.0, [
    'send your seed offering to receive',
    'guaranteed miracle money',
    'pay for your healing',
    'anointing oil cures cancer',
    'wire transfer to my personal account',
    'bitcoin doubling',
    'guaranteed 10x returns',
    'buy a miracle',
    'prophecy for a fee',
    'debt cancellation guaranteed if you sow',
  ]),
  ...terms(1.6, [
    'sow a seed of $',
    'plant your seed of faith today for',
    'financial breakthrough guaranteed',
    'click the link to claim',
    'dm me on whatsapp for prophecy',
    'limited time offer act now',
  ]),
];

export const SPAM_PATTERNS: RegExp[] = [
  /(?:https?:\/\/\S+){6,}/i, // link farm
  /(.)\1{12,}/, // character flooding
  /\b(subscribe|like|share)\b(?:\W+\b\w+\b){0,3}\W+\b(subscribe|like|share)\b(?:\W+\b\w+\b){0,3}\W+\b(subscribe|like|share)\b/i,
  /\b(?:free|win|winner|claim|prize)\b.{0,30}\b(?:now|today|instantly|guaranteed)\b/i,
  /#\w+(?:\s+#\w+){14,}/, // hashtag stuffing
];

/** Attempts to talk the reviewer or classifier into approving something. */
export const EVASION_PATTERNS: RegExp[] = [
  /ignore (?:all )?(?:previous|prior|above) instructions/i,
  /you are (?:now )?(?:an? )?(?:ai|assistant|moderator)[^.]{0,40}approve/i,
  /(?:mark|classify|rate) this (?:video|upload)? ?as (?:approved|christian|safe)/i,
  /system prompt/i,
  /\bdisregard (?:the )?(?:policy|guidelines|rules)\b/i,
  /this video is 100% christian content approve it/i,
  /<\/?(?:system|assistant|human)>/i,
];

export const COPYRIGHT_MARKERS: WeightedTerm[] = [
  ...terms(2.5, [
    'no copyright intended',
    'i do not own this content',
    'all rights belong to',
    'reupload of',
    'full album download',
    'ripped from',
  ]),
  ...terms(1.0, ['copyright disclaimer', 'fair use act', 'credit to owner']),
];

export const MISLEADING_TERMS: WeightedTerm[] = [
  ...terms(2.5, [
    'the rapture will happen on',
    'jesus returns on this exact date',
    'i have calculated the day of the lord',
    'this cure is hidden from you',
    'proven to cure all disease',
  ]),
  ...terms(1.2, ['shocking truth they hide', 'they do not want you to know']),
];

/** Christian but weighty — an age gate or content warning rather than removal. */
export const SENSITIVE_TOPIC_TERMS: WeightedTerm[] = [
  ...terms(2.0, [
    'suicide',
    'self-harm',
    'sexual abuse',
    'rape',
    'domestic violence',
    'addiction recovery',
    'pornography addiction',
    'abortion',
    'human trafficking',
    'persecution and martyrdom',
    'demonic deliverance',
    'exorcism',
  ]),
];

export const SENSITIVE_TOPIC_WARNINGS: Record<string, string> = {
  suicide: 'Discussion of suicide',
  'self-harm': 'Discussion of self-harm',
  'sexual abuse': 'Discussion of sexual abuse',
  rape: 'Discussion of sexual violence',
  'domestic violence': 'Discussion of domestic violence',
  'addiction recovery': 'Discussion of addiction',
  'pornography addiction': 'Discussion of pornography addiction',
  abortion: 'Discussion of abortion',
  'human trafficking': 'Discussion of human trafficking',
  'persecution and martyrdom': 'Depictions of persecution',
  'demonic deliverance': 'Deliverance ministry content',
  exorcism: 'Deliverance ministry content',
};
