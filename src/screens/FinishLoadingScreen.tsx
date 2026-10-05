import { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { colors } from '../theme';
import { getStoresForTrip } from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'FinishLoading'>;

export default function FinishLoadingScreen({ navigation, route }: Props) {
  const { tripId } = route.params;

  // One line per store, then a closing line.
  const [lines] = useState(() => [
    ...getStoresForTrip(tripId).map((s) => `Packing items from ${s.name}…`),
    'All packed. Saving your journey…',
  ]);
  const perLine = Math.min(800, 4000 / lines.length);
  const duration = perLine * lines.length;

  const progress = useRef(new Animated.Value(0)).current;
  const bagScale = useRef(new Animated.Value(1)).current;
  const [lineIndex, setLineIndex] = useState(0);
  const leaving = useRef(false);

  const goToLanding = () => {
    if (leaving.current) return;
    leaving.current = true;
    navigation.reset({ index: 0, routes: [{ name: 'Landing', params: { saved: true } }] });
  };

  useEffect(() => {
    const timers = lines.map((_, i) => setTimeout(() => setLineIndex(i), i * perLine));

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: false, // width can't use the native driver
    });
    animation.start(({ finished }) => {
      if (finished) goToLanding();
    });

    // Back skips the animation; the trip is already saved.
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      goToLanding();
      return true;
    });

    return () => {
      timers.forEach(clearTimeout);
      animation.stop();
      backSub.remove();
    };
  }, []);

  // The bag pulses each time the line changes.
  useEffect(() => {
    Animated.sequence([
      Animated.timing(bagScale, { toValue: 1.18, duration: 120, useNativeDriver: true }),
      Animated.spring(bagScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [lineIndex]);

  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const lastLine = lineIndex === lines.length - 1;

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>ShopHop</Text>

      <Animated.View style={[styles.bagCircle, { transform: [{ scale: bagScale }] }]}>
        <Ionicons
          name={lastLine ? 'bag-check' : 'bag-handle'}
          size={64}
          color={colors.primary}
        />
      </Animated.View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: fillWidth }]} />
      </View>

      <Text style={styles.message}>{lines[lineIndex]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  brand: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 40,
  },
  bagCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(86,226,236,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  message: {
    color: colors.textOnDark,
    textAlign: 'center',
    marginTop: 24,
    fontSize: 16,
  },
});