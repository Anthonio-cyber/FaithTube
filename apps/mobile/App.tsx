import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import { AppProvider, useApp } from '@/context/AppContext';
import { colors } from '@/theme';
import { LogoMark } from '@/components/Brand';
import { HomeScreen } from '@/screens/HomeScreen';
import { WatchScreen } from '@/screens/WatchScreen';
import { DiscoverScreen, CategoryScreen, BibleScreen } from '@/screens/DiscoverScreen';
import { ClipsScreen } from '@/screens/ClipsScreen';
import { ChannelScreen } from '@/screens/ChannelScreen';
import { CreateScreen } from '@/screens/CreateScreen';
import { ReportScreen } from '@/screens/ReportScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import { SubscriptionsScreen, LibraryScreen, ProfileScreen } from '@/screens/LibraryScreens';
import type { RootStackParamList, TabParamList } from '@/navigation';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 2;
      },
    },
  },
});

// The navigators carry the param lists so every navigate() call is checked.
const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * The bottom bar: Home, Discover, Create, Connect, Profile.
 *
 * "Create" sits in the middle as a raised gold control — FaithTube's own shape,
 * not a copy of another app's bar.
 */
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const color = focused ? colors.goldDeep : 'rgba(128,128,128,0.9)';
  const stroke = { stroke: color, strokeWidth: 1.7, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  if (name === 'Create') {
    return (
      <View style={styles.createButton}>
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M12 6v12M6 12h12" stroke={colors.navy} strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      </View>
    );
  }

  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {name === 'Home' ? (
        <>
          <Path d="M4 20V11a8 8 0 0 1 16 0v9" {...stroke} />
          <Path d="M3 20h18" {...stroke} />
          <Path d="M10 12.5 14.5 15 10 17.5Z" fill={color} />
        </>
      ) : null}
      {name === 'Discover' ? (
        <>
          <Circle cx={10.5} cy={10.5} r={6.5} {...stroke} />
          <Path d="m15.5 15.5 5 5" {...stroke} />
        </>
      ) : null}
      {name === 'Clips' ? (
        <>
          <Rect x={6.5} y={2.8} width={11} height={18.4} rx={3} {...stroke} />
          <Path d="m10.8 9.5 4 2.5-4 2.5Z" fill={color} />
        </>
      ) : null}
      {name === 'Connect' ? (
        <>
          <Circle cx={9} cy={8} r={3.2} {...stroke} />
          <Path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" {...stroke} />
          <Path d="M16.5 6.2a3 3 0 0 1 0 5.6M17.5 14.8c2 .6 3.5 2.3 3.5 4.7" {...stroke} />
        </>
      ) : null}
      {name === 'Profile' ? (
        <>
          <Circle cx={12} cy={8} r={4} {...stroke} />
          <Path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}

function Tabs() {
  const { palette, isDark } = useApp();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.goldDeep,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.background,
          borderTopColor: palette.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused }) => <TabIcon name={route.name.replace('Tab', '')} focused={focused} />,
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Home',
          headerTitle: () => (
            <View style={styles.headerBrand}>
              <LogoMark size={26} />
              <Text style={[styles.headerWord, { color: isDark ? colors.cream : colors.navy }]}>
                <Text style={{ fontWeight: '700' }}>Faith</Text>
                <Text style={{ fontWeight: '300' }}>Tube</Text>
              </Text>
            </View>
          ),
        }}
      />
      <Tab.Screen name="DiscoverTab" component={DiscoverScreen} options={{ title: 'Discover' }} />
      <Tab.Screen name="CreateTab" component={CreateScreen} options={{ title: 'Create', tabBarLabel: '' }} />
      <Tab.Screen name="ConnectTab" component={SubscriptionsScreen} options={{ title: 'Connect' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, loading, palette, isDark } = useApp();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
        <LogoMark size={64} />
        <Text style={styles.splashWord}>
          <Text style={{ fontWeight: '700' }}>Faith</Text>
          <Text style={{ fontWeight: '300' }}>Tube</Text>
        </Text>
        <Text style={styles.splashMotto}>Every Video. Christ-Centered.</Text>
      </View>
    );
  }

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: palette.background,
      card: palette.background,
      text: palette.text,
      border: palette.border,
      primary: colors.gold,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {user ? (
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: palette.background },
            headerTintColor: palette.text,
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="Watch" component={WatchScreen} options={({ route }) => ({ title: route.params.title ?? 'Watch' })} />
          <Stack.Screen name="Channel" component={ChannelScreen} options={{ title: 'Channel' }} />
          <Stack.Screen name="Category" component={CategoryScreen} options={({ route }) => ({ title: route.params.name })} />
          <Stack.Screen name="Bible" component={BibleScreen} options={{ title: 'Bible Search' }} />
          <Stack.Screen name="Clips" component={ClipsScreen} options={{ title: 'Faith Clips' }} />
          <Stack.Screen name="Library" component={LibraryScreen} options={{ title: 'Your library' }} />
          <Stack.Screen name="Report" component={ReportScreen} options={{ title: 'Report', presentation: 'modal' }} />
        </Stack.Navigator>
      ) : (
        <AuthScreen />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <Root />
        </AppProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  createButton: {
    width: 46,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerWord: { fontSize: 19, letterSpacing: -0.4 },
  splashWord: { color: colors.cream, fontSize: 30, marginTop: 14, letterSpacing: -0.6 },
  splashMotto: { color: colors.goldSoft, fontSize: 12, marginTop: 8, letterSpacing: 1, fontWeight: '600' },
});
