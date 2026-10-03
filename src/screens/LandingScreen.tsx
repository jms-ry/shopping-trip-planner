import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import {
  deleteToBuy,
  getCompletedTrips,
  getToBuy,
  seedToBuy,
  ToBuyRow,
  TripRow,
} from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

export default function LandingScreen({ navigation }: Props) {
  const [toBuy, setToBuy] = useState<ToBuyRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);

  const load = () => {
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Plan')}>
        <Text style={styles.primaryButtonText}>New trip</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>To buy ({toBuy.length})</Text>
      {toBuy.length === 0 && (
        <Text style={styles.empty}>Nothing here. Items with no stock land here after a trip.</Text>
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
      {trips.length === 0 && <Text style={styles.empty}>No completed trips yet.</Text>}
      {trips.map((trip) => (
        <View key={trip.id} style={styles.card}>
          <View style={styles.cardText}>
            <Text style={styles.itemName}>{trip.name}</Text>
            <Text style={styles.itemMeta}>
              {trip.created_at.slice(0, 10)} · {trip.bought_count}/{trip.item_count} bought
            </Text>
          </View>
        </View>
      ))}

      {__DEV__ && (
        <Pressable
          style={styles.devButton}
          onPress={() => {
            seedToBuy();
            load();
          }}
        >
          <Text style={styles.devButtonText}>[dev] Seed To buy</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  primaryButton: {
    backgroundColor: '#1f6feb',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  empty: { color: '#666', marginBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 8,
    gap: 8,
  },
  cardText: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '500' },
  itemMeta: { color: '#666', marginTop: 2 },
  smallButton: { backgroundColor: '#e8f0fe', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  smallButtonText: { color: '#1f6feb', fontWeight: '600' },
  deleteButton: { paddingVertical: 8, paddingHorizontal: 6 },
  deleteButtonText: { color: '#d1242f', fontWeight: '600' },
  devButton: { marginTop: 24, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#999', borderStyle: 'dashed', borderRadius: 8 },
  devButtonText: { color: '#666' },
});