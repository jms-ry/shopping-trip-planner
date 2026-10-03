import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { finishTrip } from '../db';
import { getReviewItems, getTripStatus, ItemStatus, ReviewItem } from '../db/queries';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

const SECTIONS: { status: ItemStatus; label: string; color: string }[] = [
  { status: 'bought', label: 'Bought', color: colors.success },
  { status: 'no_stock', label: 'No stock', color: colors.warning },
  { status: 'skipped', label: 'Skipped', color: colors.neutral },
  { status: 'pending', label: 'Not marked', color: colors.danger },
];

export default function ReviewScreen({ navigation, route }: Props) {
  const { tripId } = route.params;
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [completed, setCompleted] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setItems(getReviewItems(tripId));
      setCompleted(getTripStatus(tripId) === 'completed');
    }, [tripId])
  );

  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const noStockCount = items.filter((i) => i.status === 'no_stock').length;

  const finish = () => {
    finishTrip(tripId);
    navigation.popToTop();
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
    if (item.store_name) return item.store_name;
    return item.resolved_store_name ? `Any store · ${item.resolved_store_name}` : 'Any store';
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {SECTIONS.map((section) => {
        const rows = items.filter((i) => i.status === section.status);
        if (rows.length === 0) return null;
        return (
          <View key={section.status}>
            <Text style={[styles.sectionTitle, { color: section.color }]}>
              {section.label} ({rows.length})
            </Text>
            {rows.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {metaFor(item)}
                  {item.is_unplanned === 1 ? ' · Unplanned' : ''}
                </Text>
              </View>
            ))}
          </View>
        );
      })}

      {!completed && (
        <>
          {pendingCount > 0 && (
            <Text style={styles.hint}>
              {pendingCount} item{pendingCount === 1 ? ' is' : 's are'} still unmarked. Go back to the stores to mark them.
            </Text>
          )}
          <Pressable
            style={[styles.finishButton, pendingCount > 0 && styles.finishDisabled]}
            onPress={confirmFinish}
            disabled={pendingCount > 0}
          >
            <Text style={styles.finishText}>Finish trip</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.replace('StorePicker', { tripId })}
          >
            <Text style={styles.secondaryText}>Back to stores</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  card: { padding: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, marginBottom: 8 },
  itemName: { fontSize: 16, fontWeight: '500', color: colors.text },
  itemMeta: { color: colors.textMuted, marginTop: 2 },
  hint: { color: colors.warning, marginTop: 16 },
  finishButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  finishDisabled: { backgroundColor: colors.primaryDisabled },
  finishText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  secondaryButton: { borderWidth: 1.5, borderColor: colors.accent, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  secondaryText: { color: colors.accent, fontWeight: '600', fontSize: 16 },
});