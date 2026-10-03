import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { initDb } from './src/db';
import LandingScreen from './src/screens/LandingScreen';
import PlanScreen from './src/screens/PlanScreen';
import type { RootStackParamList } from './src/types/navigation';

initDb(); // runs once before the first render

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Landing">
        <Stack.Screen name="Landing" component={LandingScreen} options={{ title: 'Shopping Trips' }} />
        <Stack.Screen name="Plan" component={PlanScreen} options={{ title: 'Plan trip' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}