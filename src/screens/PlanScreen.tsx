import { useState } from 'react';
import { colors } from '../theme';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { createTrip, DraftItem, getToBuyById } from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'Plan'>;

const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

export default function PlanScreen({ navigation, route }: Props) {
  const toBuyId = route.params?.toBuyId;

  const [items, setItems] = useState<DraftItem[]>(() => {
    if (toBuyId !== undefined) {
      const row = getToBuyById(toBuyId);
      if (row) return [{ name: row.name, storeName: row.store_name }];
    }
    return [];
  });
  const [nameInput, setNameInput] = useState('');
  const [storeInput, setStoreInput] = useState('');
  const [anyStore, setAnyStore] = useState(false);

  const canProceed = items.some((i) => i.storeName !== null);

  const addItem = () => {
    const name = clean(nameInput);
    const store = clean(storeInput);

    if (!name) return;
    if (!anyStore && !store) {
      Alert.alert('Store missing', 'Enter a store name or turn on "Any store".');
      return;
    }

    setItems((prev) => [...prev, { name, storeName: anyStore ? null : store }]);
    setNameInput('');
    // Keep store and anyStore as they are: users often add several items per store.
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const proceed = () => {
    const tripId = createTrip(items, toBuyId !== undefined ? [toBuyId] : []);
    navigation.replace('StorePicker', { tripId });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Item</Text>
      <TextInput
        style={styles.input}
        value={nameInput}
        onChangeText={setNameInput}
        placeholder="e.g. Cooking oil"
        returnKeyType="next"
        placeholderTextColor="#888"
      />

      <Text style={styles.label}>Store</Text>
      <TextInput
        style={[styles.input, anyStore && styles.inputDisabled]}
        value={anyStore ? '' : storeInput}
        onChangeText={setStoreInput}
        placeholder={anyStore ? 'Any store' : 'e.g. Palengke'}
        editable={!anyStore}
        placeholderTextColor="#888"
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Any store</Text>
        <Switch value={anyStore} onValueChange={setAnyStore} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.surface} />
      </View>

      <Pressable style={styles.addButton} onPress={addItem}>
        <Text style={styles.addButtonText}>Add item</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Items ({items.length})</Text>
      {items.length === 0 && <Text style={styles.empty}>No items yet. Add what you need above.</Text>}
      {items.map((item, index) => (
        <View key={`${item.name}-${index}`} style={styles.card}>
          <View style={styles.cardText}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>{item.storeName ?? 'Any store'}</Text>
          </View>
          <Pressable onPress={() => removeItem(index)}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      ))}

      {!canProceed && items.length > 0 && (
        <Text style={styles.hint}>At least one item needs a store name.</Text>
      )}

      <Pressable
        style={[styles.proceedButton, !canProceed && styles.proceedDisabled]}
        onPress={proceed}
        disabled={!canProceed}
      >
        <Text style={styles.proceedText}>Proceed shopping</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  label: { fontWeight: '600', marginBottom: 4, marginTop: 8, color: colors.text },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12,
    fontSize: 16, color: colors.text, backgroundColor: colors.surface,
  },
  inputDisabled: { backgroundColor: colors.muted },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  switchLabel: { fontSize: 16, color: colors.text },
  addButton: { backgroundColor: colors.primary, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  addButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 24, marginBottom: 8, color: colors.text },
  empty: { color: colors.textMuted },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, marginBottom: 8, gap: 8,
  },
  cardText: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '500', color: colors.text },
  itemMeta: { color: colors.textMuted, marginTop: 2 },
  removeText: { color: colors.danger, fontWeight: '600' },
  hint: { color: colors.warning, marginTop: 8 },
  proceedButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  proceedDisabled: { backgroundColor: colors.primaryDisabled },
  proceedText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
});