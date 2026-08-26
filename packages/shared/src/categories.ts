export interface CategoryDefinition {
  slug: string;
  name: string;
  description: string;
  /** Short line used on the home page rail header. */
  blurb: string;
  /** Terms that raise the Christian-relevance score for this category. */
  keywords: string[];
  /** Shown in onboarding interest picker. */
  onboarding: boolean;
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    slug: 'sermons',
    name: 'Sermons',
    description: 'Preaching from Scripture — Sunday messages, expository series, revival and conference preaching.',
    blurb: 'Preaching that opens the Word',
    keywords: ['sermon', 'preaching', 'message', 'pulpit', 'homily', 'exposition', 'pastor', 'sunday service'],
    onboarding: true,
  },
  {
    slug: 'bible-studies',
    name: 'Bible Studies',
    description: 'Verse-by-verse teaching, book studies, hermeneutics and small-group material.',
    blurb: 'Go deeper, verse by verse',
    keywords: ['bible study', 'scripture', 'exegesis', 'book of', 'chapter', 'commentary', 'devotional study'],
    onboarding: true,
  },
  {
    slug: 'worship',
    name: 'Worship',
    description: 'Corporate worship, hymns, psalms and instrumental worship sets.',
    blurb: 'Songs for the gathered church',
    keywords: ['worship', 'hymn', 'praise', 'psalm', 'chorus', 'worship set', 'acoustic worship'],
    onboarding: true,
  },
  {
    slug: 'christian-music',
    name: 'Christian Music',
    description: 'Gospel, contemporary Christian music, choirs, spoken word and Christian hip-hop.',
    blurb: 'Music that lifts the name of Jesus',
    keywords: ['gospel music', 'christian music', 'choir', 'ccm', 'gospel song', 'christian rap', 'spoken word'],
    onboarding: true,
  },
  {
    slug: 'testimonies',
    name: 'Testimonies',
    description: 'First-person accounts of salvation, healing, deliverance and God’s faithfulness.',
    blurb: 'What God has done',
    keywords: ['testimony', 'my story', 'saved', 'salvation story', 'God changed', 'delivered', 'born again'],
    onboarding: true,
  },
  {
    slug: 'evangelism',
    name: 'Evangelism',
    description: 'Gospel presentations, street evangelism, apologetics and outreach training.',
    blurb: 'Taking the Gospel outward',
    keywords: ['evangelism', 'gospel presentation', 'street preaching', 'outreach', 'apologetics', 'soul winning'],
    onboarding: true,
  },
  {
    slug: 'christian-animation',
    name: 'Christian Animation',
    description: 'Animated Bible stories, parables and teaching for children and families.',
    blurb: 'Bible stories brought to life',
    keywords: ['animation', 'animated bible', 'bible story for kids', 'cartoon', 'parable animation'],
    onboarding: true,
  },
  {
    slug: 'youth',
    name: 'Youth',
    description: 'Teaching, discipleship and encouragement for teenagers and young adults.',
    blurb: 'For the next generation',
    keywords: ['youth', 'teen', 'young adults', 'campus ministry', 'discipleship for youth'],
    onboarding: true,
  },
  {
    slug: 'family',
    name: 'Family',
    description: 'Marriage, parenting, family devotions and Christian home life.',
    blurb: 'Faith at home',
    keywords: ['family', 'marriage', 'parenting', 'family devotion', 'christian home', 'household'],
    onboarding: true,
  },
  {
    slug: 'missions',
    name: 'Missions',
    description: 'Missionary reports, field stories, church planting and cross-cultural ministry.',
    blurb: 'Stories from the field',
    keywords: ['missions', 'missionary', 'church planting', 'unreached', 'mission field', 'cross-cultural'],
    onboarding: true,
  },
  {
    slug: 'prayer',
    name: 'Prayer',
    description: 'Prayer meetings, intercession, guided prayer and fasting teaching.',
    blurb: 'Praying together',
    keywords: ['prayer', 'intercession', 'prayer meeting', 'fasting', 'praying', 'petition'],
    onboarding: false,
  },
  {
    slug: 'documentaries',
    name: 'Documentaries',
    description: 'Christian documentaries, church history and biographies of the faithful.',
    blurb: 'Christian stories, told well',
    keywords: ['documentary', 'church history', 'biography', 'martyrs', 'reformation', 'revival history'],
    onboarding: false,
  },
  {
    slug: 'podcasts',
    name: 'Podcasts',
    description: 'Long-form Christian conversation, interviews and roundtable teaching.',
    blurb: 'Conversations worth your commute',
    keywords: ['podcast', 'interview', 'conversation', 'roundtable', 'episode'],
    onboarding: false,
  },
  {
    slug: 'teaching',
    name: 'Christian Education',
    description: 'Theology courses, seminary-style lectures and discipleship curricula.',
    blurb: 'Learn the faith deeply',
    keywords: ['theology', 'doctrine', 'systematic', 'lecture', 'seminary', 'catechism', 'course'],
    onboarding: false,
  },
];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

export function categoryBySlug(slug: string): CategoryDefinition | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
