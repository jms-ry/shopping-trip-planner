import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = { onDone: () => void };

const SIZE = 280; // same as imageWidth in app.json
const TOTAL = 3000;
const HOPS = 4;

export default function AppSplash({ onDone }: Props) {
  const hop = useRef(new Animated.Value(0)).current; // 0 on the ground, 1 at the peak
  const progress = useRef(new Animated.Value(0)).current;
  const intro = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const leaving = useRef(false);

  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => onDone());
  };

  useEffect(() => {
    const hopOnce = Animated.sequence([
      Animated.timing(hop, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(hop, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    const hops = Animated.sequence([
      Animated.delay(150),
      Animated.loop(hopOnce, { iterations: HOPS }),
    ]);
    const bar = Animated.timing(progress, {
      toValue: 1,
      duration: TOTAL,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false, // width can't use the native driver
    });
    const text = Animated.timing(intro, {
      toValue: 1,
      duration: 400,
      delay: 300,
      useNativeDriver: true,
    });

    hops.start();
    text.start();
    bar.start(({ finished }) => {
      if (finished) leave();
    });

    return () => {
      hops.stop();
      bar.stop();
      text.stop();
    };
  }, []);

  const translateY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -60] });
  const rotate = hop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '8deg'] });
  const scaleY = hop.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0.93, 1, 1.03] });
  const scaleX = hop.interpolate({ inputRange: [0, 0.12, 1], outputRange: [1.05, 1, 0.98] });
  const shadowScale = hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] });
  const shadowOpacity = hop.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.12] });
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View style={[styles.container, { opacity: fade }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={leave} accessibilityLabel="Skip intro" />

      <View style={styles.stage} pointerEvents="none">
        <Animated.View
          style={[styles.shadow, { opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] }]}
        />
        <Animated.Image
          source={require('../../assets/splash-icon.png')}
          style={[
            styles.kangaroo,
            { transform: [{ translateY }, { rotate }, { scaleX }, { scaleY }] },
          ]}
          resizeMode="contain"
        />
      </View>

      <Animated.View style={[styles.below, { opacity: intro }]} pointerEvents="none">
        <Text style={styles.wordmark}>ShopHop</Text>
        <Text style={styles.tagline}>Hop between shops. Forget nothing.</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: barWidth }]} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: { width: SIZE, height: SIZE },
  kangaroo: { width: SIZE, height: SIZE },
  // The feet sit at about 89% of the image height.
  shadow: {
    position: 'absolute',
    top: SIZE * 0.89 - 6,
    left: (SIZE - 150) / 2,
    width: 150,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#000',
  },
  // Absolute, so the kangaroo stays exactly where the native splash put it.
  below: {
    position: 'absolute',
    top: '50%',
    marginTop: SIZE / 2 + 24,
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  wordmark: { color: colors.accent, fontSize: 30, fontWeight: '800' },
  tagline: { color: colors.textMuted, fontSize: 14 },
  track: {
    width: 160,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginTop: 14,
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
});