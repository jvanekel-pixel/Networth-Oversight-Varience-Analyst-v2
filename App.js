import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, AppState, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import theme from './src/config/theme.config';
import personality from './src/config/personality.config';
import notificationsConfig from './src/config/notifications.config';
import useStore from './src/store/useStore';
import {
  requestNotificationPermissions,
  scheduleLocalNotification,
  scheduleCalendarNotification,
  cancelAllNotifications,
  schedulePaydayReminder,
  addQuickLogNotificationResponseListener,
  configureNotificationActions,
  getLastQuickLogNotificationUrl,
} from './src/utils/notifications';
import { useExport } from './src/hooks/useExport';

import NovaHeader from './src/components/NovaHeader';
import BadgeUnlockOverlay from './src/components/badges/BadgeUnlockOverlay';
import NovaIcon from './src/components/icons/NovaIcon';
import { LogTransactionModal } from './src/components/TransactionModal';
import AppLockGate from './src/components/AppLockGate';
import { WizardProvider } from './src/screens/onboarding/WizardContext';
import WelcomeScreen from './src/screens/onboarding/WelcomeScreen';
import OnboardingUserModeScreen from './src/screens/onboarding/OnboardingUserModeScreen';
import OnboardingAccountsScreen from './src/screens/onboarding/OnboardingAccountsScreen';
import OnboardingIncomeScreen from './src/screens/onboarding/OnboardingIncomeScreen';
import OnboardingBillsScreen from './src/screens/onboarding/OnboardingBillsScreen';
import OnboardingBucketsScreen from './src/screens/onboarding/OnboardingBucketsScreen';
import OnboardingSavingsGoalScreen from './src/screens/onboarding/OnboardingSavingsGoalScreen';
import OnboardingEntrepreneurScreen from './src/screens/onboarding/OnboardingEntrepreneurScreen';
import OnboardingPaycheckSplitScreen from './src/screens/onboarding/OnboardingPaycheckSplitScreen';
import OnboardingReviewScreen from './src/screens/onboarding/OnboardingReviewScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import HouseholdScreen from './src/screens/HouseholdScreen';
import PersonalScreen from './src/screens/PersonalScreen';
import BusinessScreen from './src/screens/BusinessScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import TransactionSearchScreen from './src/screens/TransactionSearchScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import BadgeShowcaseScreen from './src/screens/BadgeShowcaseScreen';
import BusinessSelectorScreen from './src/screens/BusinessSelectorScreen';
import BusinessDetailScreen from './src/screens/BusinessDetailScreen';
import {
  resolveWidgetAccount,
  scheduleAndroidWidgetSync,
} from './src/utils/androidWidgets';
import {
  buildActiveAccountOptions,
  submitTransactionPayload,
} from './src/utils/splitTransactions';
import {
  isAppLockEnabled,
  normalizeAppLockSettings,
} from './src/utils/appLock';
import { parseNovaQuickLogUrl } from './src/utils/quickLog';

enableScreens(false);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const OnboardingStack = createNativeStackNavigator();

function getNextSunday7pm() {
  const now = new Date();
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilSunday);
  next.setHours(19, 0, 0, 0);
  return next;
}

function getNextDailyTime(hour, minute) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

function getDayBeforeDate(dateMs) {
  const d = new Date(dateMs);
  d.setDate(d.getDate() - 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

const NOTIF_PERM_KEY = 'nova_v2_notif_perm_asked';
const LAST_ACTIVITY_KEY = 'nova_v2_lastActivityAt';
const NUDGE_SENT_KEY = 'nova_v2_nudge_sent_at';
const NOTIFIED_BILLS_KEY = 'nova_v2_notified_bills';
const TAB_ICON_BY_NAME = {
  [theme.tabDashboard]: 'dashboard',
  [theme.tabHousehold]: 'household',
  [theme.tabPersonal]: 'personal',
  [theme.tabBusiness]: 'business',
  [theme.tabSettings]: 'settings',
};

async function getNotifToggles() {
  try {
    const raw = await AsyncStorage.getItem('nova_v2_notif_toggles');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function scheduleRecurringNotifications(incomeEvents) {
  // Cancel all existing scheduled notifications before rescheduling
  await cancelAllNotifications();

  const toggles = await getNotifToggles();

  // Weekly variance summary — next Sunday at 19:00 (rescheduled on every foreground resume)
  if (toggles.weeklyVarianceSummary !== false) {
    const cfg = notificationsConfig.weeklyVarianceSummary;
    await scheduleCalendarNotification(
      'weekly_variance',
      cfg.title.replace('{zone}', 'HOUSEHOLD'),
      cfg.body.replace('{zone}', 'household').replace('{state}', 'updated'),
      { type: 'date', date: getNextSunday7pm() },
    );
  }

  // NOVA daily disposition — next occurrence of configurable time
  if (toggles.novaDailyDisposition !== false) {
    const dailyTimeRaw = await AsyncStorage.getItem('nova_v2_notif_daily_time');
    const dailyTime = dailyTimeRaw ? JSON.parse(dailyTimeRaw) : '09:00';
    const [h, m] = dailyTime.split(':').map(Number);
    const bodies = notificationsConfig.novaDailyDisposition.bodies;
    const dailyBody = bodies[Math.floor(Math.random() * bodies.length)];
    await scheduleCalendarNotification(
      'nova_daily',
      notificationsConfig.novaDailyDisposition.title,
      dailyBody,
      { type: 'date', date: getNextDailyTime(h || 9, m || 0) },
    );
  }

  // Pay cycle reminder — 18:00 the day before nextPaycheckDate
  if (toggles.payCycleReminder !== false && incomeEvents?.nextPaycheckDate) {
    const dayBefore = getDayBeforeDate(incomeEvents.nextPaycheckDate);
    if (dayBefore.getTime() > Date.now()) {
      const cfg = notificationsConfig.payCycleReminder;
      const pcDate = new Date(incomeEvents.nextPaycheckDate);
      const dateStr = pcDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      await scheduleCalendarNotification(
        'paycheck_reminder',
        cfg.title,
        cfg.body.replace('{paycheckDate}', dateStr),
        { type: 'date', date: dayBefore },
      );
    }
  }

  // Payday reminder — 09:00 on nextPaycheckDate itself
  const novaConfigRaw = await AsyncStorage.getItem('nova_v2_config');
  const novaConfig = novaConfigRaw ? JSON.parse(novaConfigRaw) : {};
  if (novaConfig.paydayReminderEnabled !== false && incomeEvents?.nextPaycheckDate) {
    await schedulePaydayReminder(incomeEvents.nextPaycheckDate);
  }

}

async function runOneTimeChecks(incomeEvents, checkAndRunAutoExport) {
  const novaConfigRaw = await AsyncStorage.getItem('nova_v2_config');
  const novaConfig = novaConfigRaw ? JSON.parse(novaConfigRaw) : {};
  const userMode = novaConfig.userMode;

  const toggles = await getNotifToggles();

  // CHECK A — Balance nudge (>48h inactive), dedup via NUDGE_SENT_KEY
  if (toggles.balanceConfirmationNudge !== false) {
    const lastRaw = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
    const lastActivity = lastRaw ? JSON.parse(lastRaw) : null;
    const isInactive = !lastActivity || Date.now() - lastActivity > 48 * 60 * 60 * 1000;
    if (isInactive) {
      const nudgeSentRaw = await AsyncStorage.getItem(NUDGE_SENT_KEY);
      const nudgeSentAt = nudgeSentRaw ? JSON.parse(nudgeSentRaw) : 0;
      const needsNewNudge = Date.now() - nudgeSentAt > 48 * 60 * 60 * 1000;
      if (needsNewNudge) {
        const cfg = notificationsConfig.balanceConfirmationNudge;
        await scheduleLocalNotification('balance_nudge', cfg.title, cfg.body, 10);
        await AsyncStorage.setItem(NUDGE_SENT_KEY, JSON.stringify(Date.now()));
      }
    }
  }

  // CHECK B — Partner deposit not received this month (skip for solo users)
  if (userMode !== 'solo' && toggles.partnerDepositMissed !== false && incomeEvents?.partnerDepositExpectedDay) {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const dayOfMonth = today.getDate();
    const depositDue = dayOfMonth >= incomeEvents.partnerDepositExpectedDay;
    const alreadyReceived = incomeEvents?.partnerDepositLastReceivedMonth === currentMonth;
    if (depositDue && !alreadyReceived) {
      const cfg = notificationsConfig.partnerDepositMissed;
      await scheduleLocalNotification('partner_deposit_missed', cfg.title, cfg.body, 5);
    }
  }

  // CHECK C — Auto-export
  if (checkAndRunAutoExport) {
    await checkAndRunAutoExport().catch(() => {});
  }

  // CHECK D — Bill due alerts (Task 5)
  if (toggles.billDueAlert !== false) {
    const storeState = useStore.getState();
    const { accounts, householdBills, personalBills, varianceCache } = storeState;
    const allBills = [
      ...(householdBills || []).map(bill => ({ bill, profile: 'household' })),
      ...(personalBills || []).map(bill => ({ bill, profile: 'personal' })),
    ];
    const today = new Date();
    const currentDayOfMonth = today.getDate();
    const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const notifiedRaw = await AsyncStorage.getItem(NOTIFIED_BILLS_KEY);
    const notifiedBills = notifiedRaw ? JSON.parse(notifiedRaw) : [];

    for (const { bill, profile } of allBills.filter(({ bill }) => bill.isActive !== false && !bill.deleted)) {
      const dueDay = bill.expectedDay || bill.dueDay;
      if (!dueDay) continue;
      const daysUntil = dueDay - currentDayOfMonth;
      if (daysUntil < 0 || daysUntil > 3) continue;
      const billKey = `${bill.id}-${yearMonth}`;
      if (notifiedBills.includes(billKey)) continue;
      const accountKey = bill.defaultAccountKey || bill.accountKey;
      const projectedBalance = accountKey && typeof accounts?.[accountKey] === 'number'
        ? accounts[accountKey]
        : varianceCache?.[profile]?.balance || 0;
      if (projectedBalance < (bill.amountCents || 0)) {
        const cfg = notificationsConfig.billDueAlert;
        await scheduleLocalNotification(
          `bill_due_${bill.id}`,
          cfg.title,
          cfg.body.replace('{billName}', bill.name).replace('{daysUntil}', String(daysUntil)),
          10,
        );
        notifiedBills.push(billKey);
      }
    }
    await AsyncStorage.setItem(NOTIFIED_BILLS_KEY, JSON.stringify(notifiedBills));
  }

}

async function runAppOpenChecks(incomeEvents, checkAndRunAutoExport) {
  // Request permissions once
  const permAsked = await AsyncStorage.getItem(NOTIF_PERM_KEY);
  if (!permAsked) {
    const toggles = await getNotifToggles();
    const anyEnabled = Object.values(toggles).some(v => v !== false);
    // Default: request if no prefs set yet (user hasn't disabled everything)
    if (anyEnabled || Object.keys(toggles).length === 0) {
      await requestNotificationPermissions();
    }
    await AsyncStorage.setItem(NOTIF_PERM_KEY, 'true');
  }

  await scheduleRecurringNotifications(incomeEvents);
  await runOneTimeChecks(incomeEvents, checkAndRunAutoExport);
}

function MainTabs() {
  const entrepreneurMode = useStore((s) => s.novaConfig?.entrepreneurMode);
  const userMode = useStore((s) => s.novaConfig?.userMode);
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 16);
  const tabBarHeight = 58 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: bottomInset,
          backgroundColor: theme.backgroundSecondary,
          borderTopColor: theme.borderColorDim,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarIconStyle: styles.tabIconSlot,
        tabBarItemStyle: [styles.tabItem, { minHeight: 48 }],
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => (
          <View style={styles.tabIconShell}>
            <NovaIcon
              name={TAB_ICON_BY_NAME[route.name] || 'dashboard'}
              color={color}
              focused={focused}
              size={28}
            />
          </View>
        ),
      })}
    >
      <Tab.Screen name={theme.tabDashboard} component={DashboardScreen} />
      {userMode === 'partnered' && (
        <Tab.Screen name={theme.tabHousehold} component={HouseholdScreen} />
      )}
      <Tab.Screen name={theme.tabPersonal} component={PersonalScreen} />
      {entrepreneurMode && (
        <Tab.Screen name={theme.tabBusiness} component={BusinessScreen} />
      )}
      <Tab.Screen name={theme.tabSettings} component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function OnboardingNav() {
  return (
    <NavigationContainer>
      <WizardProvider>
        <OnboardingStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <OnboardingStack.Screen name="OnboardingWelcome" component={WelcomeScreen} />
          <OnboardingStack.Screen name="OnboardingUserMode" component={OnboardingUserModeScreen} />
          <OnboardingStack.Screen name="OnboardingAccounts" component={OnboardingAccountsScreen} />
          <OnboardingStack.Screen name="OnboardingIncome" component={OnboardingIncomeScreen} />
          <OnboardingStack.Screen name="OnboardingPaycheckSplit" component={OnboardingPaycheckSplitScreen} />
          <OnboardingStack.Screen name="OnboardingBills" component={OnboardingBillsScreen} />
          <OnboardingStack.Screen name="OnboardingBuckets" component={OnboardingBucketsScreen} />
          <OnboardingStack.Screen name="OnboardingSavingsGoal" component={OnboardingSavingsGoalScreen} />
          <OnboardingStack.Screen name="OnboardingEntrepreneur" component={OnboardingEntrepreneurScreen} />
          <OnboardingStack.Screen name="OnboardingReview" component={OnboardingReviewScreen} />
        </OnboardingStack.Navigator>
      </WizardProvider>
    </NavigationContainer>
  );
}

function LoadingShell() {
  return (
    <View style={styles.bootRoot}>
      <StatusBar hidden={true} />
      <Text style={styles.bootTitle}>N.O.V.A.</Text>
      <Text style={styles.bootText}>Loading local records...</Text>
    </View>
  );
}

function AppContent() {
  const onboardingComplete = useStore((s) => s.novaConfig?.onboardingComplete);
  const initStore = useStore((s) => s.initStore);
  const rotateFlavorText = useStore((s) => s.rotateFlavorText);
  const checkCycleReset = useStore((s) => s.checkCycleReset);
  const recomputeVariance = useStore((s) => s.recomputeVariance);
  const incomeEvents = useStore((s) => s.incomeEvents);
  const pruneExpiredPostPaydayActions = useStore((s) => s.pruneExpiredPostPaydayActions);
  const accounts = useStore((s) => s.accounts);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const novaConfig = useStore((s) => s.novaConfig);
  const logTransaction = useStore((s) => s.logTransaction);
  const checkSpendingFloors = useStore((s) => s.checkSpendingFloors);
  const appLockSettings = useMemo(() => normalizeAppLockSettings(novaConfig?.appLock), [novaConfig?.appLock]);
  const lockEnabled = isAppLockEnabled(appLockSettings);
  const [storeReady, setStoreReady] = useState(false);
  const [appLocked, setAppLocked] = useState(false);
  const [widgetLogVisible, setWidgetLogVisible] = useState(false);
  const [widgetLogAccountKey, setWidgetLogAccountKey] = useState(null);
  const [widgetLogDraft, setWidgetLogDraft] = useState(null);
  const [widgetLogType, setWidgetLogType] = useState('expense');
  const [widgetLogSource, setWidgetLogSource] = useState('android_widget');
  const lastBackgroundAtRef = useRef(null);
  const { checkAndRunAutoExport } = useExport();

  const widgetLogAccount = useMemo(() => {
    return resolveWidgetAccount({ accounts, accountRegistry, novaConfig }, widgetLogAccountKey);
  }, [accounts, accountRegistry, novaConfig, widgetLogAccountKey]);
  const widgetLogAccountOptions = useMemo(
    () => buildActiveAccountOptions(accountRegistry, accounts).map(option => ({
      ...option,
      label: String(option.label || option.key).toUpperCase(),
    })),
    [accountRegistry, accounts],
  );

  const openWidgetLog = useCallback((accountKey = null, draft = null, type = 'expense', source = 'android_widget') => {
    const account = resolveWidgetAccount(useStore.getState(), accountKey);
    if (account?.key) setWidgetLogAccountKey(account.key);
    setWidgetLogDraft(draft);
    setWidgetLogType(type === 'income' ? 'income' : 'expense');
    setWidgetLogSource(source || 'android_widget');
    setWidgetLogVisible(true);
  }, []);

  const handleIncomingQuickLogUrl = useCallback(async (url) => {
    const parsed = parseNovaQuickLogUrl(url);
    if (!parsed) return;
    const state = useStore.getState();
    const account = resolveWidgetAccount(state, parsed.accountKey);
    const draft = {
      draftId: parsed.draftId,
      amountRaw: parsed.amountRaw,
      amountCents: parsed.amountCents,
      description: parsed.description,
      category: parsed.category,
    };
    const lockActive = isAppLockEnabled(normalizeAppLockSettings(state.novaConfig?.appLock));
    if (parsed.autoSubmit && parsed.amountCents > 0 && account?.key && !lockActive) {
      const signedAmount = parsed.type === 'income' ? parsed.amountCents : -parsed.amountCents;
      await submitTransactionPayload(logTransaction, {
        amountCents: signedAmount,
        category: parsed.category,
        description: parsed.description || 'Quick log',
      }, account.key, {
        source: parsed.source,
        sourceType: 'android_quick_log',
      });
      checkSpendingFloors();
      scheduleAndroidWidgetSync(useStore.getState(), 100);
      return;
    }
    openWidgetLog(parsed.accountKey, draft, parsed.type, parsed.source);
  }, [checkSpendingFloors, logTransaction, openWidgetLog]);

  useEffect(() => {
    initStore().then(() => {
      const initializedState = useStore.getState();
      const initializedAppLock = normalizeAppLockSettings(initializedState.novaConfig?.appLock);
      setAppLocked(isAppLockEnabled(initializedAppLock));
      setStoreReady(true);
      rotateFlavorText(personality.starterPool);
      checkCycleReset();
      recomputeVariance();
      pruneExpiredPostPaydayActions();
      runAppOpenChecks(initializedState.incomeEvents, checkAndRunAutoExport);
      scheduleAndroidWidgetSync(initializedState, 100);
      configureNotificationActions();
    });
  }, []);

  useEffect(() => {
    const unsubscribe = useStore.subscribe((state) => {
      scheduleAndroidWidgetSync(state);
    });
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!onboardingComplete) return undefined;
    let mounted = true;
    Linking.getInitialURL().then((url) => {
      if (mounted) handleIncomingQuickLogUrl(url);
    }).catch(() => {});
    getLastQuickLogNotificationUrl().then((url) => {
      if (mounted && url) handleIncomingQuickLogUrl(url);
    }).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handleIncomingQuickLogUrl(url));
    const notifSub = addQuickLogNotificationResponseListener((url) => handleIncomingQuickLogUrl(url));
    return () => {
      mounted = false;
      sub.remove();
      notifSub.remove();
    };
  }, [onboardingComplete, handleIncomingQuickLogUrl]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive' || nextState === 'background') {
        lastBackgroundAtRef.current = Date.now();
        const currentState = useStore.getState();
        const currentAppLock = normalizeAppLockSettings(currentState.novaConfig?.appLock);
        if (currentState.novaConfig?.onboardingComplete && isAppLockEnabled(currentAppLock)) {
          setAppLocked(true);
        }
      }
      if (nextState === 'active') {
        const currentState = useStore.getState();
        const currentAppLock = normalizeAppLockSettings(currentState.novaConfig?.appLock);
        const elapsed = lastBackgroundAtRef.current ? Date.now() - lastBackgroundAtRef.current : Infinity;
        if (currentState.novaConfig?.onboardingComplete && isAppLockEnabled(currentAppLock) && elapsed >= currentAppLock.lockAfterMs) {
          setAppLocked(true);
        }
        checkCycleReset();
        pruneExpiredPostPaydayActions();
        runAppOpenChecks(incomeEvents, checkAndRunAutoExport);
        scheduleAndroidWidgetSync(useStore.getState(), 100);
      }
    });
    return () => sub.remove();
  }, [incomeEvents, checkAndRunAutoExport, pruneExpiredPostPaydayActions]);

  useEffect(() => {
    if (!storeReady || !onboardingComplete) return;
    if (!lockEnabled) setAppLocked(false);
  }, [storeReady, onboardingComplete, lockEnabled]);

  const handleWidgetLogSubmit = async (payload) => {
    const accountKey = widgetLogAccount?.key || widgetLogAccountKey;
    if (!accountKey) return;
    await submitTransactionPayload(logTransaction, {
      ...payload,
      description: payload?.description || 'Android widget expense',
      splits: (payload?.splits || []).map(split => ({
        ...split,
        description: split.description || payload?.description || 'Android widget expense',
      })),
    }, accountKey, {
      source: widgetLogSource,
      sourceType: widgetLogSource === 'android_widget' ? 'android_widget' : 'android_quick_log',
    });
    checkSpendingFloors();
    scheduleAndroidWidgetSync(useStore.getState(), 100);
  };

  if (!storeReady) {
    return <LoadingShell />;
  }

  if (!onboardingComplete) {
    return <OnboardingNav />;
  }

  return (
    <View style={styles.root}>
      <StatusBar hidden={true} />
      <NovaHeader />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Calendar" component={CalendarScreen} />
          <Stack.Screen name="TransactionSearch" component={TransactionSearchScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
          <Stack.Screen name="Badges" component={BadgeShowcaseScreen} />
          <Stack.Screen name="BusinessSelector" component={BusinessSelectorScreen} />
          <Stack.Screen name="BusinessDetail" component={BusinessDetailScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <BadgeUnlockOverlay />
      <LogTransactionModal
        visible={widgetLogVisible}
        type={widgetLogType}
        accountName={widgetLogAccount?.label || 'Widget account'}
        profile={widgetLogAccount?.role || 'personal'}
        defaultAccountKey={widgetLogAccount?.key || widgetLogAccountKey}
        accountOptions={widgetLogAccountOptions}
        initialDraft={widgetLogDraft}
        onSubmit={handleWidgetLogSubmit}
        onClose={() => {
          setWidgetLogVisible(false);
          setWidgetLogDraft(null);
          setWidgetLogType('expense');
          setWidgetLogSource('android_widget');
        }}
      />
      <AppLockGate
        visible={appLocked && lockEnabled}
        settings={appLockSettings}
        onUnlocked={() => {
          lastBackgroundAtRef.current = null;
          setAppLocked(false);
        }}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
  bootRoot: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacingLG,
  },
  bootTitle: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXXL,
    fontWeight: 'bold',
  },
  bootText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    marginTop: theme.spacingSM,
  },
  tabItem: {
    paddingVertical: 2,
  },
  tabIconSlot: {
    width: 34,
    height: 34,
    marginTop: 2,
  },
  tabIconShell: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: theme.fontPrimary,
    fontSize: 9,
    letterSpacing: 0.7,
  },
});
