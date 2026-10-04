import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CartLoading'>;

const MESSAGES = ['Your cart is being made…', 'Polishing the wheels…', 'Ready to fill it up!'];
const DURATION = 1800;
const CART_SIZE = 34;

export default function CartLoadingScreen({ navigation }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const [barWidth, setBarWidth] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setMessageIndex(1), 600),
      setTimeout(() => setMessageIndex(2), 1250),
    ];

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false, // width can't use the native driver
    });
    animation.start(({ finished }) => {
      if (finished) navigation.replace('Plan');
    });

    return () => {
      timers.forEach(clearTimeout);
      animation.stop();
    };
  }, []);

  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const cartX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, barWidth - CART_SIZE)],
  });

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>ShopHop</Text>

      <View style={styles.barArea} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.cart, { transform: [{ translateX: cartX }] }]}>
          <Ionicons name="cart" size={CART_SIZE} color={colors.primary} />
        </Animated.View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: fillWidth }]} />
        </View>
      </View>

      <Text style={styles.message}>{MESSAGES[messageIndex]}</Text>
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
  barArea: { width: '100%' },
  cart: { marginBottom: 6 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  message: { color: colors.textOnDark, textAlign: 'center', marginTop: 24, fontSize: 16 },
});