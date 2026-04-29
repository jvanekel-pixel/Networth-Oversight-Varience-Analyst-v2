import React, { useEffect } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { enableScreens } from 'react-native-screens';

import theme from './src/config/theme.config';
import personality from './src/config/personality.config';
import useStore from './src/store/useStore';

import NovaHeader from './src/components/NovaHeader';
import OnboardingScreen from './src/screens/OnboardingScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import HouseholdScreen from './src/screens/HouseholdScreen';
import PersonalScreen from './src/screens/PersonalScreen';
import BusinessScreen from './src/screens/BusinessScreen';
import SettingsScreen from './src/screens/SettingsScreen';

enableScreens(false);

const Tab = createBottomTabNavigator();

export default function App() {
  const onboardingComplete = useStore((s) => s.onboardingComplete);
  const initStore = useStore((s) => s.initStore);
  const rotateFlavorText = useStore((s) => s.rotateFlavorText);
  const checkCycleReset = useStore((s) => s.checkCycleReset);
  const recomputeVariance = useStore((s) => s.recomputeVariance);

  useEffect(() => {
    initStore().then(() => {
      rotateFlavorText(personality.starterPool);
      checkCycleReset();
      recomputeVariance();
    });
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkCycleReset();
    });
    return () => sub.remove();
  }, []);

  if (!onboardingComplete) {
    return <OnboardingScreen />;
  }

  return (
    <View style={styles.root}>
      <NovaHeader />
      <NavigationContainer>
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
