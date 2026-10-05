import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import ProgressBar from '../components/ProgressBar';
import { finishTrip } from '../db';
import { colors, radius } from '../theme';
import { getReviewItems, getTrip, ItemStatus, ReviewItem } from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;
type IconName = keyof typeof Ionicons.glyphMap;

const SECTIONS: { status: ItemStatus; label: string; color: string; icon: IconName }[] = [
  { status: 'bought', label: 'Bought', color: colors.success, icon: 'checkmark-circle' },
  { status: 'no_stock', label: 'No stock', color: colors.warning, icon: 'alert-circle' },
  { status: 'skipped', label: 'Skipped', color: colors.neutral, icon: 'remove-circle' },
  { status: 'pending', label: 'Not marked', color: colors.danger, icon: 'ellipse-outline' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TEAR = 14;

// SQLite stores UTC as "YYYY-MM-DD HH:MM:SS".
const formatDate = (createdAt: string) => {
  const d = new Date(createdAt.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return createdAt.slice(0, 10);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const DashedLine = () => (
  <Text style={styles.dashed} numberOfLines={1} ellipsizeMode="clip">
    {'- '.repeat(80)}
  </Text>
);

export default function ReviewScreen({ navigation, route }: Props) {
  const { tripId } = route.params;
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [trip, setTrip] = useState<ReturnType<typeof getTrip>>(null);
  const [filter, setFilter] = useState<ItemStatus | null>(null);
  const [receiptWidth, setReceiptWidth] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setItems(getReviewItems(tripId));
      setTrip(getTrip(tripId));
    }, [tripId])
  );

  const count = (status: ItemStatus) => items.filter((i) => i.status === status).length;
  const completed = trip?.status === 'completed';
  const total = items.length;
  const boughtCount = count('bought');
  const pendingCount = count('pending');
  const noStockCount = count('no_stock');

  const finish = () => {
    finishTrip(tripId);
    navigation.replace('FinishLoading', { tripId });
  };

  const confirmFinish = () => {
    if (noStockCount === 0) {
      finish();
      return;
    }
    Alert.alert(
      'Finish trip',
      `${noStockCount} no-stock item${noStockCount === 1 ? '' : 's'} will be added to your To buy list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Finish', onPress: finish },
      ]
    );
  };

  const metaFor = (item: ReviewItem) => {
    const where =
      item.store_name ??
      (item.resolved_store_name ? `Any store · ${item.resolved_store_name}` : 'Any store');
    return item.is_unplanned === 1 ? `${where} · Unplanned` : where;
  };

  const tiles = SECTIONS.filter((s) => s.status !== 'pending' || pendingCount > 0);
  const tearCount = receiptWidth > 0 ? Math.ceil(receiptWidth / TEAR) + 1 : 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.receipt} onLayout={(e) => setReceiptWidth(e.nativeEvent.layout.width)}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.tripName} numberOfLines={2}>
              {trip?.name ?? ''}
            </Text>
            <Text style={styles.date}>{trip ? formatDate(trip.created_at) : ''}</Text>
          </View>
          <View style={[styles.badge, completed ? styles.badgeSaved : styles.badgeReview]}>
            <Text style={[styles.badgeText, completed && { color: colors.textOnDark }]}>
              {completed ? 'Saved' : 'Review'}
            </Text>
          </View>
        </View>

        <DashedLine />

        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {boughtCount} of {total} bought
          </Text>
          <ProgressBar value={boughtCount} total={total} color={colors.success} />
        </View>

        <View style={styles.tiles}>
          {tiles.map((s) => {
            const selected = filter === s.status;
            return (
              <Pressable
                key={s.status}
                style={[
                  styles.tile,
                  selected && { borderColor: s.color, backgroundColor: colors.surface },
                ]}
                onPress={() => setFilter(selected ? null : s.status)}
              >
                <Ionicons name={s.icon} size={20} color={s.color} />
                <Text style={[styles.tileCount, { color: s.color }]}>{count(s.status)}</Text>
                <Text style={styles.tileLabel}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.tileCaption}>Tap a count to filter the list</Text>

        <DashedLine />

        {SECTIONS.filter((s) => !filter || s.status === filter).map((section) => {
          const rows = items.filter((i) => i.status === section.status);
          if (rows.length === 0) return null;
          return (
            <View key={section.status} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name={section.icon} size={18} color={section.color} />
                <Text style={[styles.sectionTitle, { color: section.color }]}>{section.label}</Text>
                <Text style={styles.sectionCount}>{rows.length}</Text>
              </View>
              {rows.map((item, index) => (
                <View key={item.id} style={[styles.itemRow, index > 0 && styles.rowDivider]}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <View style={styles.storeTag}>
                    <Ionicons
                      name={item.store_name ? 'storefront-outline' : 'shuffle'}
                      size={13}
                      color={colors.textMuted}
                    />
                    <Text style={styles.storeTagText}>{metaFor(item)}</Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })}

        <DashedLine />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total items</Text>
          <Text style={styles.totalValue}>{total}</Text>
        </View>
      </View>

      {/* Torn edge */}
      <View style={[styles.tearRow, { width: receiptWidth }]}>
        {Array.from({ length: tearCount }).map((_, i) => (
          <View key={i} style={styles.tearTooth} />
        ))}
      </View>

      {!completed && (
        <View style={styles.actions}>
          {pendingCount > 0 && (
            <Text style={styles.hint}>
              {pendingCount} item{pendingCount === 1 ? ' is' : 's are'} still unmarked. Go back to
              the stores to mark them.
            </Text>
          )}
          <Pressable
            style={[styles.finishButton, pendingCount > 0 && styles.finishDisabled]}
            onPress={confirmFinish}
            disabled={pendingCount > 0}
          >
            <Ionicons
              name="checkmark-done"
              size={20}
              color={pendingCount > 0 ? colors.mutedOnDark : colors.onPrimary}
            />
            <Text style={[styles.finishText, pendingCount > 0 && styles.finishTextDisabled]}>
              Finish trip
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.replace('StorePicker', { tripId })}
          >
            <Text style={styles.secondaryText}>Back to stores</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },

  receipt: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingVertical: 16,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16 },
  headerText: { flex: 1 },
  tripName: { fontSize: 20, fontWeight: '800', color: colors.text },
  date: { color: colors.textMuted, marginTop: 2 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeSaved: { backgroundColor: colors.success },
  badgeReview: { backgroundColor: colors.amber },
  badgeText: { color: colors.onPrimary, fontWeight: '700', fontSize: 12 },

  dashed: {
    color: colors.border,
    fontSize: 12,
    marginVertical: 12,
    paddingHorizontal: 16,
  },

  summary: { paddingHorizontal: 16, gap: 6 },
  summaryText: { color: colors.text, fontWeight: '600' },
  tiles: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 14 },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.field,
  },
  tileCount: { fontSize: 22, fontWeight: '800' },
  tileLabel: { fontSize: 12, color: colors.textMuted },
  tileCaption: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 8 },

  section: { paddingHorizontal: 16, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionCount: { color: colors.textMuted, fontWeight: '600' },
  itemRow: { paddingVertical: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.muted },
  itemName: { fontSize: 16, fontWeight: '600', color: colors.text },
  storeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  storeTagText: { color: colors.textMuted, fontSize: 13 },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  totalLabel: { fontWeight: '700', color: colors.text },
  totalValue: { fontWeight: '800', color: colors.text },

  // Zigzag edge: diamonds in the page color, centered on the receipt's bottom edge.
  tearRow: { flexDirection: 'row', marginTop: -TEAR / 2, marginLeft: -TEAR / 2 },
  tearTooth: {
    width: TEAR,
    height: TEAR,
    backgroundColor: colors.background,
    transform: [{ rotate: '45deg' }],
  },

  actions: { marginTop: 24, gap: 12 },
  hint: { color: colors.amber },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: radius.md,
  },
  finishDisabled: { backgroundColor: 'rgba(86,226,236,0.2)' },
  finishText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  finishTextDisabled: { color: colors.mutedOnDark },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  secondaryText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
});