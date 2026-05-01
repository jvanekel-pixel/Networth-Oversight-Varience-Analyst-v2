import React, { useEffect } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';
import AsyncStorage from '@react-native-async-storage/async-storage';

import theme from './src/config/theme.config';
import personality from './src/config/personality.config';
import notificationsConfig from './src/config/notifications.config';
import useStore from './src/store/useStore';
import {
  requestNotificationPermissions,
  scheduleLocalNotification,
  cancelNotification,
} from './src/utils/notifications';

import NovaHeader from './src/components/NovaHeader';
import OnboardingScreen from './src/screens/OnboardingScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import HouseholdScreen from './src/screens/HouseholdScreen';
import PersonalScreen from './src/screens/PersonalScreen';
import BusinessScreen from './src/screens/BusinessScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import BusinessSelectorScreen from './src/screens/BusinessSelectorScreen';
import MassageScreen from './src/screens/MassageScreen';
import CleaningScreen from './src/screens/CleaningScreen';

enableScreens(false);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const NOTIF_PERM_KEY = 'nova_v2_notif_perm_asked';
const LAST_ACTIVITY_KEY = 'nova_v2_last_activity';

async function runAppOpenNotifications(incomeEvents) {
  // Request permissions once
  const permAsked = await AsyncStorage.getItem(NOTIF_PERM_KEY);
  if (!permAsked) {
    await requestNotificationPermissions();
    await AsyncStorage.setItem(NOTIF_PERM_KEY, 'true');
  }

  // Balance nudge if >48h inactive
  const lastRaw = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
  const lastActivity = lastRaw ? JSON.parse(lastRaw) : null;
  if (!lastActivity || Date.now() - lastActivity > 48 * 60 * 60 * 1000) {
    const cfg = notificationsConfig.balanceConfirmationNudge;
    await scheduleLocalNotification('balance_nudge', cfg.title, cfg.body, 10);
  }

  // Paycheck reminder if tomorrow
  if (incomeEvents?.nextPaycheckDate) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pcDate = new Date(incomeEvents.nextPaycheckDate);
    const isTomorrow =
      pcDate.getDate() === tomorrow.getDate() &&
      pcDate.getMonth() === tomorrow.getMonth() &&
      pcDate.getFullYear() === tomorrow.getFullYear();
    if (isTomorrow) {
      const cfg = notificationsConfig.payCycleReminder;
      const dateStr = pcDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      await scheduleLocalNotification(
        'paycheck_reminder',
        cfg.title,
        cfg.body.replace('{paycheckDate}', dateStr),
        30,
      );
    }
  }

  // Weekly variance summary — next Sunday at 7pm
  await cancelNotification('weekly_variance');
  const now = new Date();
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(19, 0, 0, 0);
  const secondsUntilSunday = Math.floor((nextSunday.getTime() - now.getTime()) / 1000);
  if (secondsUntilSunday > 0) {
    const cfg = notificationsConfig.weeklyVarianceSummary;
    await scheduleLocalNotification(
      'weekly_variance',
      cfg.title.replace('{zone}', 'HOUSEHOLD'),
      cfg.body.replace('{zone}', 'household').replace('{state}', 'updated'),
      secondsUntilSunday,
    );
  }

  // NOVA daily disposition — next occurrence of defaultTime
  await cancelNotification('nova_daily');
  const [h, m] = notificationsConfig.novaDailyDisposition.defaultTime.split(':').map(Number);
  const nextDaily = new Date();
  nextDaily.setHours(h, m, 0, 0);
  if (nextDaily.getTime() <= Date.now()) nextDaily.setDate(nextDaily.getDate() + 1);
  const secondsUntilDaily = Math.floor((nextDaily.getTime() - Date.now()) / 1000);
  const bodies = notificationsConfig.novaDailyDisposition.bodies;
  const dailyBody = bodies[Math.floor(Math.random() * bodies.length)];
  await scheduleLocalNotification(
    'nova_daily',
    notificationsConfig.novaDailyDisposition.title,
    dailyBody,
    secondsUntilDaily,
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.backgroundSecondary },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textDim,
        tabBarLabelStyle: { fontFamily: theme.fontPrimary, fontSize: theme.fontSizeXS },
      }}
    >
      <Tab.Screen name={theme.tabDashboard} component={DashboardScreen} />
      <Tab.Screen name={theme.tabHousehold} component={HouseholdScreen} />
      <Tab.Screen name={theme.tabPersonal} component={PersonalScreen} />
      <Tab.Screen name={theme.tabBusiness} component={BusinessScreen} />
      <Tab.Screen name={theme.tabSettings} component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const onboardingComplete = useStore((s) => s.onboardingComplete);
  const initStore = useStore((s) => s.initStore);
  const rotateFlavorText = useStore((s) => s.rotateFlavorText);
  const checkCycleReset = useStore((s) => s.checkCycleReset);
  const recomputeVariance = useStore((s) => s.recomputeVariance);
  const incomeEvents = useStore((s) => s.incomeEvents);

  useEffect(() => {
    initStore().then(() => {
      rotateFlavorText(personality.starterPool);
      checkCycleReset();
      recomputeVariance();
      runAppOpenNotifications(incomeEvents);
    });
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkCycleReset();
        runAppOpenNotifications(incomeEvents);
      }
    });
    return () => sub.remove();
  }, [incomeEvents]);

  if (!onboardingComplete) {
    return <OnboardingScreen />;
  }

  return (
    <View style={styles.root}>
      <NovaHeader />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Calendar" component={CalendarScreen} />
          <Stack.Screen name="BusinessSelector" component={BusinessSelectorScreen} />
          <Stack.Screen name="Massage" component={MassageScreen} />
          <Stack.Screen name="Cleaning" component={CleaningScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
});
