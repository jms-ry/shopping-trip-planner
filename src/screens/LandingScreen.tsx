import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { colors } from '../theme';

import {
  deleteToBuy,
  getCompletedTrips,
  getToBuy,
  ToBuyRow,
  TripRow,
  discardTrip,
  getInProgressTrips,
  InProgressTrip,
  endTripEarly,
} from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

export default function LandingScreen({ navigation }: Props) {
  const [toBuy, setToBuy] = useState<ToBuyRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [inProgress, setInProgress] = useState<InProgressTrip[]>([]);
  const load = () => {
    setToBuy(getToBuy());
    setTrips(getCompletedTrips());
    setInProgress(getInProgressTrips());
    setToBuy(getToBuy());
    setTrips(getCompletedTrips());
  };

  // Reload every time the screen regains focus (e.g. after finishing a trip).
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Plan')}>
        <Text style={styles.primaryButtonText}>New trip</Text>
      </Pressable>
      {inProgress.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>In progress ({inProgress.length})</Text>
          {inProgress.map((trip) => (
            <View key={trip.id} style={styles.card}>
              <View style={styles.cardText}>
                <Text style={styles.itemName}>{trip.name}</Text>
                <Text style={styles.itemMeta}>
                  {trip.created_at.slice(0, 10)} · {trip.marked_count}/{trip.item_count} marked
                </Text>
              </View>
              <Pressable style={styles.smallButton} onPress={() => resume(trip)}>
                <Text style={styles.smallButtonText}>Resume</Text>
              </Pressable>
              {(() => {
                const allBought = trip.item_count > 0 && trip.bought_count === trip.item_count;
                if (allBought) return null; // Trip A: resume only
                if (trip.bought_count > 0) {
                  // Trip B: keep what was bought
                  return (
                    <Pressable style={styles.deleteButton} onPress={() => confirmEndTrip(trip)}>
                      <Text style={styles.deleteButtonText}>End trip</Text>
                    </Pressable>
                  );
                }
                // Trip C: nothing bought
                return (
                  <Pressable style={styles.deleteButton} onPress={() => confirmDiscard(trip)}>
                    <Text style={styles.deleteButtonText}>Discard</Text>
                  </Pressable>
                );
              })()}
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>To buy ({toBuy.length})</Text>
      {toBuy.length === 0 && (
        <Text style={styles.empty}>Nothing to buy later. Items marked No stock land here after a trip.</Text>
      )}
      {toBuy.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardText}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>{item.store_name ?? 'Any store'}</Text>
          </View>
          <Pressable
            style={styles.smallButton}
            onPress={() => navigation.navigate('Plan', { toBuyId: item.id })}
          >
            <Text style={styles.smallButtonText}>Add to trip</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={() => confirmDelete(item)}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Saved journeys ({trips.length})</Text>
      {trips.length === 0 && <Text style={styles.empty}>No journeys yet. Finish a trip and it will be saved here.</Text>}
      {trips.map((trip) => (
        <Pressable
          key={trip.id}
          style={styles.card}
          onPress={() => navigation.navigate('Review', { tripId: trip.id })}
        >
          <View style={styles.cardText}>
            <Text style={styles.itemName}>{trip.name}</Text>
            <Text style={styles.itemMeta}>
              {trip.created_at.slice(0, 10)} · {trip.bought_count}/{trip.item_count} bought
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  primaryButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 24 },
  primaryButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 8, marginBottom: 8, color: colors.text },
  empty: { color: colors.textMuted, marginBottom: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, marginBottom: 8, gap: 8,
  },
  cardText: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '500', color: colors.text },
  itemMeta: { color: colors.textMuted, marginTop: 2 },
  smallButton: { backgroundColor: colors.tint, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  smallButtonText: { color: colors.accent, fontWeight: '600' },
  deleteButton: { paddingVertical: 8, paddingHorizontal: 6 },
  deleteButtonText: { color: colors.danger, fontWeight: '600' },
});