import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = { value: number; total: number; color?: string };

export default function ProgressBar({ value, total, color = colors.accent }: Props) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={styles.track}>
      <View
        style={[styles.fill, { width: `${pct * 100}%` as `${number}%`, backgroundColor: color }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});