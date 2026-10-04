import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { colors } from '../theme';
import { getStoresForTrip } from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'TripLoading'>;

const DURATION = 2000;
const ICON_SIZE = 34;

export default function TripLoadingScreen({ navigation, route }: Props) {
  const { tripId } = route.params;
  const progress = useRef(new Animated.Value(0)).current;
  const [barWidth, setBarWidth] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [stores] = useState(() => getStoresForTrip(tripId));

  const messages = [
    'Sorting your items by store…',
    'Planning your route…',
    stores.length === 1
      ? 'One stop. Let’s go!'
      : `${stores.length} stops lined up. Let’s hop!`,
  ];

  useEffect(() => {
    const timers = [
      setTimeout(() => setMessageIndex(1), 600),
      setTimeout(() => setMessageIndex(2), 1250),
    ];

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.linear,
      useNativeDriver: false, // width can't use the native driver
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      if (stores.length === 1 && stores[0].status === 'open') {
        navigation.replace('StoreShopping', { tripId, storeId: stores[0].id });
      } else {
        navigation.replace('StorePicker', { tripId });
      }
    });

    return () => {
      timers.forEach(clearTimeout);
      animation.stop();
    };
  }, []);

  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const iconX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, barWidth - ICON_SIZE)],
  });
  // Four hops along the way.
  const iconY = progress.interpolate({
    inputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
    outputRange: [0, -12, 0, -12, 0, -12, 0, -12, 0],
  });

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>ShopHop</Text>

      <View style={styles.barArea} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        <Animated.View
          style={[styles.icon, { transform: [{ translateX: iconX }, { translateY: iconY }] }]}
        >
          <Ionicons name="storefront" size={ICON_SIZE} color={colors.primary} />
        </Animated.View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: fillWidth }]} />
        </View>
      </View>

      <Text style={styles.message}>{messages[messageIndex]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  brand: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 48,
  },
  barArea: { width: '100%', paddingTop: 14 },
  icon: { marginBottom: 6 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  message: { color: colors.textOnDark, textAlign: 'center', marginTop: 24, fontSize: 16 },
});