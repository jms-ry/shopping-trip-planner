import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import {
  addUnplannedItem,
  deleteUnplannedItem,
  getItemsForStore,
  getOpenStoreCount,
  getStoreById,
  ItemStatus,
  markStoreDone,
  setItemStatus,
  ShopItem,
} from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'StoreShopping'>;

const OPTIONS: { status: Exclude<ItemStatus, 'pending'>; label: string; color: string }[] = [
  { status: 'bought', label: 'Bought', color: '#1a7f37' },
  { status: 'no_stock', label: 'No stock', color: '#bc4c00' },
  { status: 'skipped', label: 'Skip', color: '#6e7781' },
];

export default function StoreShoppingScreen({ navigation, route }: Props) {
  const { tripId, storeId } = route.params;
  const [items, setItems] = useState<ShopItem[]>([]);
  const [newItem, setNewItem] = useState('');

  const load = () => setItems(getItemsForStore(tripId, storeId));

  useFocusEffect(
    useCallback(() => {
      load();
      const store = getStoreById(storeId);
      if (store) navigation.setOptions({ title: store.name });
    }, [tripId, storeId])
  );

  const mark = (item: ShopItem, status: Exclude<ItemStatus, 'pending'>) => {
    const next: ItemStatus = item.status === status ? 'pending' : status;
    // Any-store items remember where they were resolved.
    const resolvedStoreId = item.store_id === null && next !== 'pending' ? storeId : null;
    setItemStatus(item.id, next, resolvedStoreId);
    load();
  };

  const addUnplanned = () => {
    const name = newItem.trim().replace(/\s+/g, ' ');
    if (!name) return;
    addUnplannedItem(tripId, storeId, name);
    setNewItem('');
    load();
  };

  const removeUnplanned = (item: ShopItem) => {
    deleteUnplannedItem(item.id);
    load();
  };

  const pendingOwn = items.filter((i) => i.store_id !== null && i.status === 'pending').length;
  const canFinish = pendingOwn === 0;

  const finishStore = () => {
    markStoreDone(storeId);

    if (getOpenStoreCount(tripId) > 0) {
      const routes = navigation.getState().routes;
      const previous = routes[routes.length - 2];
      if (previous?.name === 'StorePicker') {
        navigation.goBack();
      } else {
        navigation.replace('StorePicker', { tripId });
      }
    } else {
      navigation.replace('Review', { tripId });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {items.length === 0 && <Text style={styles.empty}>No items for this store.</Text>}

      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.store_id === null && <Text style={styles.tag}>Any store</Text>}
            {item.is_unplanned === 1 && <Text style={styles.tag}>Unplanned</Text>}
            {item.is_unplanned === 1 && (
              <Pressable onPress={() => removeUnplanned(item)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.optionRow}>
            {OPTIONS.map((opt) => {
              const selected = item.status === opt.status;
              return (
                <Pressable
                  key={opt.status}
                  style={[
                    styles.optionButton,
                    { borderColor: opt.color },
                    selected && { backgroundColor: opt.color },
                  ]}
                  onPress={() => mark(item, opt.status)}
                >
                  <Text style={[styles.optionText, { color: selected ? '#fff' : opt.color }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Bought something not on the list?</Text>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={newItem}
          onChangeText={setNewItem}
          placeholder="Item name"
          onSubmitEditing={addUnplanned}
        />
        <Pressable style={styles.addButton} onPress={addUnplanned}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      {!canFinish && (
        <Text style={styles.hint}>
          {pendingOwn} item{pendingOwn === 1 ? '' : 's'} left to mark.
        </Text>
      )}

      <Pressable
        style={[styles.doneButton, !canFinish && styles.doneDisabled]}
        onPress={finishStore}
        disabled={!canFinish}
      >
        <Text style={styles.doneText}>Done with this store</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  empty: { color: '#666', marginBottom: 12 },
  card: { padding: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  itemName: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  tag: { fontSize: 12, color: '#555', backgroundColor: '#eee', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  removeText: { color: '#d1242f', fontWeight: '600', marginLeft: 'auto' },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionButton: { flex: 1, paddingVertical: 10, borderWidth: 1.5, borderRadius: 8, alignItems: 'center' },
  optionText: { fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  addRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  addButton: { backgroundColor: '#56e2ec', paddingHorizontal: 18, borderRadius: 8, justifyContent: 'center' },
  addButtonText: { color: '#010408', fontWeight: '600' },
  hint: { color: '#b35900', marginTop: 16 },
  doneButton: { backgroundColor: '#1f6feb', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  doneDisabled: { backgroundColor: '#a8c4f0' },
  doneText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});