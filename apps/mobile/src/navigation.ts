import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

/** Every route and the parameters it takes, so navigation is type-checked. */
export type RootStackParamList = {
  Tabs: undefined;
  Watch: { slug: string; title?: string };
  Channel: { handle: string };
  Category: { slug: string; name: string };
  Bible: undefined;
  Clips: undefined;
  Library: undefined;
  Report: { targetType: string; targetId: string; label: string };
};

export type TabParamList = {
  HomeTab: undefined;
  DiscoverTab: undefined;
  CreateTab: undefined;
  ConnectTab: undefined;
  ProfileTab: undefined;
};

export type StackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

/**
 * Tab screens can also push onto the parent stack (a home card opens Watch),
 * so their props compose both navigators.
 */
export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
