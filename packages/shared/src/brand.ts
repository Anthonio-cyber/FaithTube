/**
 * Central brand configuration.
 *
 * Everything user-visible about the platform identity lives here so the product
 * can be re-branded (name, motto, palette, contact) without touching feature code.
 */
export const brand = {
  name: 'FaithTube',
  shortName: 'FaithTube',
  motto: 'Every Video. Christ-Centered.',
  supportingMotto: 'Watch. Learn. Worship. Share.',
  tagline: 'A Place Where Faith Meets Video.',
  description:
    'A dedicated Christian video platform for sermons, Bible studies, worship, testimonies and Gospel-centred storytelling.',
  supportEmail: 'support@faithtube.example',
  /** Original palette — deep navy, warm gold, cream. Deliberately unlike any existing video platform. */
  palette: {
    navy: '#0B1730',
    navyDeep: '#060D1D',
    navySoft: '#152444',
    gold: '#D8A24A',
    goldSoft: '#F0CE8E',
    cream: '#FBF7EF',
    plum: '#3A2A5C',
    mist: '#E4E9F2',
    verified: '#3FA37A',
  },
} as const;

export type Brand = typeof brand;
