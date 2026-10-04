import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import ProgressBar from '../components/ProgressBar';
import { colors, radius} from '../theme';
import {
  deleteToBuy,
  discardTrip,
  endTripEarly,
  getCompletedTrips,
  getInProgressTrips,
  getToBuy,
  InProgressTrip,
  ToBuyRow,
  TripRow,
} from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

export default function LandingScreen({ navigation }: Props) {
  const [inProgress, setInProgress] = useState<InProgressTrip[]>([]);
  const [toBuy, setToBuy] = useState<ToBuyRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);

  const load = () => {
    setInProgress(getInProgressTrips());
    setToBuy(getToBuy());
    setTrips(getCompletedTrips());
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const confirmDelete = (item: ToBuyRow) => {
    Alert.alert('Delete item', `Remove "${item.name}" from the list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteToBuy(item.id);
          load();
        },
      },
    ]);
  };

  const resume = (trip: InProgressTrip) => {
    if (trip.open_stores === 0) {
      navigation.navigate('Review', { tripId: trip.id });
    } else {
      navigation.navigate('StorePicker', { tripId: trip.id });
    }
  };

  const confirmDiscard = (trip: InProgressTrip) => {
    Alert.alert(
      'Discard trip',
      'Every item goes back to your To buy list. Nothing was bought on this trip.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            discardTrip(trip.id);
            load();
          },
        },
      ]
    );
  };

  const confirmEndTrip = (trip: InProgressTrip) => {
    const unbought = trip.item_count - trip.bought_count;
    Alert.alert(
      'End trip',
      `The ${trip.bought_count} bought item${trip.bought_count === 1 ? '' : 's'} will be saved as a journey. Unbought items go to your To buy list (${unbought}).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End trip',
          onPress: () => {
            endTripEarly(trip.id);
            load();
          },
        },
      ]
    );
  };

  const SectionHeader = ({ title, count }: { title: string; count: number }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{count}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Hop between shops.{'\n'}Forget nothing.</Text>
        <Pressable style={styles.heroButton} onPress={() => navigation.navigate('CartLoading')}>
          <Ionicons name="add" size={22} color={colors.primary} />
          <Text style={styles.heroButtonText}>New trip</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        {inProgress.length > 0 && (
          <>
            <SectionHeader title="In progress" count={inProgress.length} />
            {inProgress.map((trip) => {
              const allBought = trip.item_count > 0 && trip.bought_count === trip.item_count;
              return (
                <View key={trip.id} style={[styles.card, styles.tripCard]}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.itemName}>{trip.name}</Text>
                    <Text style={styles.itemMeta}>{trip.created_at.slice(0, 10)}</Text>
                  </View>
                  <ProgressBar value={trip.marked_count} total={trip.item_count} />
                  <Text style={styles.itemMeta}>
                    {trip.marked_count} of {trip.item_count} marked
                  </Text>
                  <View style={styles.actionRow}>
                    <Pressable style={styles.resumeButton} onPress={() => resume(trip)}>
                      <Text style={styles.resumeText}>Resume</Text>
                      <Ionicons name="arrow-forward" size={16} color={colors.onPrimary} />
                    </Pressable>
                    {!allBought && trip.bought_count > 0 && (
                      <Pressable style={styles.textButton} onPress={() => confirmEndTrip(trip)}>
                        <Text style={styles.textButtonLabel}>End trip</Text>
                      </Pressable>
                    )}
                    {trip.bought_count === 0 && (
                      <Pressable style={styles.textButton} onPress={() => confirmDiscard(trip)}>
                        <Text style={[styles.textButtonLabel, { color: colors.danger }]}>Discard</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        <SectionHeader title="To buy" count={toBuy.length} />
        {toBuy.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={30} color={colors.mutedOnDark} />
            <Text style={styles.empty}>
              Nothing waiting. Items marked No stock land here after a trip.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {toBuy.map((item, index) => (
              <View key={item.id} style={[styles.row, index > 0 && styles.rowDivider]}>
                <View style={styles.rowText}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <View style={styles.storeTag}>
                    <Ionicons name="storefront-outline" size={13} color={colors.mutedOnDark} />
                    <Text style={styles.storeTagText}>{item.store_name ?? 'Any store'}</Text>
                  </View>
                </View>
                <Pressable
                  style={styles.addPill}
                  onPress={() => navigation.navigate('Plan', { toBuyId: item.id })}
                >
                  <Ionicons name="add" size={16} color={colors.onPrimary} />
                  <Text style={styles.addPillText}>Add to trip</Text>
                </Pressable>
                <Pressable
                  style={styles.iconButton}
                  onPress={() => confirmDelete(item)}
                  accessibilityLabel="Delete"
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <SectionHeader title="Saved journeys" count={trips.length} />
        {trips.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="map-outline" size={30} color={colors.mutedOnDark} />
            <Text style={styles.empty}>No journeys yet. Finish a trip and it will be saved here.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {trips.map((trip, index) => (
              <Pressable
                key={trip.id}
                style={[styles.row, index > 0 && styles.rowDivider]}
                onPress={() => navigation.navigate('Review', { tripId: trip.id })}
              >
                <View style={styles.rowText}>
                  <Text style={styles.itemName}>{trip.name}</Text>
                  <Text style={styles.itemMeta}>
                    {trip.created_at.slice(0, 10)} · {trip.bought_count} of {trip.item_count} bought
                  </Text>
                  <View style={{ marginTop: 6 }}>
                    <ProgressBar
                      value={trip.bought_count}
                      total={trip.item_count}
                      color={colors.success}
                    />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedOnDark} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 48 },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroTitle: { fontSize: 26, fontWeight: '800', lineHeight: 32, color: colors.onPrimary },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.onPrimary,
    paddingVertical: 14,
    borderRadius: radius.md,
    marginTop: 18,
  },
  heroButtonText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  body: { padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textOnDark },
  countBadge: { backgroundColor: colors.tint, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: 10,
  },
  tripCard: { padding: 14, gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  resumeText: { color: colors.onPrimary, fontWeight: '700' },
  textButton: { paddingVertical: 10, paddingHorizontal: 8 },
  textButtonLabel: { color: colors.accent, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.muted },
  rowText: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: colors.text },
  itemMeta: { color: colors.textMuted, marginTop: 2 },
  storeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  storeTagText: { color: colors.textMuted, fontSize: 13 },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  addPillText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  iconButton: { padding: 6 },
  emptyBox: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    marginBottom: 10,
  },
  empty: { color: colors.mutedOnDark, textAlign: 'center' },
});