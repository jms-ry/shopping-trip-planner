import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { initDb } from './src/db';
import { colors } from './src/theme';
import type { RootStackParamList } from './src/types/navigation';
import AppSplash from './src/components/AppSplash';
import LandingScreen from './src/screens/LandingScreen';
import CartLoadingScreen from './src/screens/CartLoadingScreen';
import PlanScreen from './src/screens/PlanScreen';
import TripLoadingScreen from './src/screens/TripLoadingScreen';
import StorePickerScreen from './src/screens/StorePickerScreen';
import StoreShoppingScreen from './src/screens/StoreShoppingScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import FinishLoadingScreen from './src/screens/FinishLoadingScreen';

initDb(); // runs once before the first render

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  if (!splashDone) {
    return (
      <>
        <StatusBar style="dark" />
        <AppSplash onDone={() => setSplashDone(true)} />
      </>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName="Landing"
        screenOptions={{
          headerStyle: { backgroundColor: colors.accent },
          headerTintColor: colors.onColor,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Landing" component={LandingScreen} options={{ title: 'ShopHop' }} />
        <Stack.Screen
          name="CartLoading"
          component={CartLoadingScreen}
          options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
        />
        <Stack.Screen name="Plan" component={PlanScreen} options={{ title: 'Plan trip' }} />
        <Stack.Screen
          name="TripLoading"
          component={TripLoadingScreen}
          options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="StorePicker"
          component={StorePickerScreen}
          options={{ title: 'Choose store' }}
        />
        <Stack.Screen
          name="StoreShopping"
          component={StoreShoppingScreen}
          options={{ title: 'Shopping' }}
        />
        <Stack.Screen name="Review" component={ReviewScreen} options={{ title: 'Review trip' }} />
        <Stack.Screen
          name="FinishLoading"
          component={FinishLoadingScreen}
          options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}