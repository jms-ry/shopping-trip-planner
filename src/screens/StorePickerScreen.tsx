import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { colors } from '../theme';
import {
  getPendingAnyStoreCount,
  getStoresForTrip,
  reopenStore,
  StoreRow,
} from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'StorePicker'>;

export default function StorePickerScreen({ navigation, route }: Props) {
  const { tripId } = route.params;
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [anyPending, setAnyPending] = useState(0);

  // Single store: skip the picker. Runs on mount only.
  useEffect(() => {
    const rows = getStoresForTrip(tripId);
    if (rows.length === 1 && rows[0].status === 'open') {
      navigation.replace('StoreShopping', { tripId, storeId: rows[0].id });
    }
  }, []);
  
  const load = () => {
    setStores(getStoresForTrip(tripId));
    setAnyPending(getPendingAnyStoreCount(tripId));
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [tripId])
  );

  const openStore = (store: StoreRow) => {
    navigation.navigate('StoreShopping', { tripId, storeId: store.id });
  };

  const reopen = (store: StoreRow) => {
    reopenStore(store.id);
    load();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Where to next?</Text>
      <Text style={styles.subtitle}>
        Any-store items left: {anyPending}
      </Text>

      {stores.map((store) => {
        const done = store.status === 'done';
        return (
          <Pressable
            key={store.id}
            style={[styles.card, done && styles.cardDone]}
            onPress={() => !done && openStore(store)}
            disabled={done}
          >
            <View style={styles.cardText}>
              <Text style={styles.storeName}>{store.name}</Text>
              <Text style={styles.meta}>
                {done
                  ? 'Done'
                  : `${store.pending} of ${store.total} item${store.total === 1 ? '' : 's'} pending`}
              </Text>
            </View>
            {done && (
              <Pressable style={styles.reopenButton} onPress={() => reopen(store)}>
                <Text style={styles.reopenText}>Reopen</Text>
              </Pressable>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1.5,
    borderColor: colors.accent, backgroundColor: colors.surface, borderRadius: 12, marginBottom: 10, gap: 8,
  },
  cardDone: { borderColor: colors.border, backgroundColor: colors.muted },
  cardText: { flex: 1 },
  storeName: { fontSize: 18, fontWeight: '600', color: colors.text },
  meta: { color: colors.textMuted, marginTop: 2 },
  reopenButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.tint },
  reopenText: { color: colors.accent, fontWeight: '600' },
});