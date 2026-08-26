import type { ComponentType, SVGProps } from 'react';
import {
  IconClips,
  IconClock,
  IconConnect,
  IconDiscover,
  IconLibrary,
  IconLive,
  IconMinistry,
  IconPremium,
  IconSave,
  IconSettings,
  IconSparkle,
  IconWatch,
  IconBook,
  IconChart,
  IconShield,
} from '@/components/ui/Icons';

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Hidden until the person is signed in. */
  requiresAuth?: boolean;
  end?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * FaithTube's own navigation structure: Discover, Watch, Connect, Library,
 * Ministry, Profile. Ministry is the section that has no equivalent elsewhere —
 * it groups the platform around how a church actually uses video.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'discover',
    label: 'Discover',
    items: [
      { label: 'Home', to: '/', icon: IconDiscover, end: true },
      { label: 'Trending', to: '/trending', icon: IconSparkle },
      { label: 'Categories', to: '/categories', icon: IconLibrary },
      { label: 'Faith Clips', to: '/clips', icon: IconClips },
      { label: 'Live', to: '/live', icon: IconLive },
    ],
  },
  {
    id: 'watch',
    label: 'Watch',
    items: [
      { label: 'Continue Watching', to: '/library?tab=continue', icon: IconWatch, requiresAuth: true },
      { label: 'History', to: '/history', icon: IconClock, requiresAuth: true },
      { label: 'Saved Videos', to: '/library?tab=saved', icon: IconSave, requiresAuth: true },
    ],
  },
  {
    id: 'connect',
    label: 'Connect',
    items: [
      { label: 'Subscriptions', to: '/subscriptions', icon: IconConnect, requiresAuth: true },
      { label: 'Community', to: '/community', icon: IconConnect, requiresAuth: true },
    ],
  },
  {
    id: 'library',
    label: 'Library',
    items: [
      { label: 'Playlists', to: '/playlists', icon: IconLibrary, requiresAuth: true },
      { label: 'Downloads', to: '/library?tab=downloads', icon: IconSave, requiresAuth: true },
    ],
  },
  {
    id: 'ministry',
    label: 'Ministry',
    items: [
      { label: 'Sermons', to: '/categories/sermons', icon: IconMinistry },
      { label: 'Bible Studies', to: '/categories/bible-studies', icon: IconBook },
      { label: 'Worship', to: '/categories/worship', icon: IconMinistry },
      { label: 'Evangelism', to: '/categories/evangelism', icon: IconMinistry },
      { label: 'Bible Search', to: '/bible', icon: IconBook },
    ],
  },
];

export const PROFILE_ITEMS: NavItem[] = [
  { label: 'Premium', to: '/premium', icon: IconPremium },
  { label: 'Settings', to: '/settings', icon: IconSettings, requiresAuth: true },
];

export const CREATOR_ITEMS: NavItem[] = [
  { label: 'Creator Studio', to: '/studio', icon: IconChart, requiresAuth: true },
];

export const STAFF_ITEMS: NavItem[] = [{ label: 'Moderation', to: '/admin', icon: IconShield, requiresAuth: true }];

/** The five destinations on the mobile bottom bar. */
export const MOBILE_NAV: NavItem[] = [
  { label: 'Home', to: '/', icon: IconDiscover, end: true },
  { label: 'Discover', to: '/categories', icon: IconSparkle },
  { label: 'Create', to: '/upload', icon: IconClips, requiresAuth: true },
  { label: 'Connect', to: '/subscriptions', icon: IconConnect, requiresAuth: true },
  { label: 'Profile', to: '/settings', icon: IconSettings },
];
