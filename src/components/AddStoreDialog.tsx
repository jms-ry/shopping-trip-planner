import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { addStoreWithItems, AddStoreResult, getStoresForTrip, StoreRow } from '../db/queries';

type Props = {
  visible: boolean;
  tripId: number;
  onClose: () => void;
  onAdded: (result: AddStoreResult, storeName: string) => void;
};

const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

export default function AddStoreDialog({ visible, tripId, onClose, onAdded }: Props) {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeName, setStoreName] = useState('');
  const [itemInput, setItemInput] = useState('');
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    if (visible) setStores(getStoresForTrip(tripId));
  }, [visible, tripId]);

  const name = clean(storeName);
  const existing = stores.find((s) => s.name.toLowerCase() === name.toLowerCase());
  const pendingItem = clean(itemInput);
  const canSubmit = name.length > 0 && (items.length > 0 || pendingItem.length > 0);

  const reset = () => {
    setStoreName('');
    setItemInput('');
    setItems([]);
  };

  const close = () => {
    reset();
    onClose();
  };

  const addItem = () => {
    if (!pendingItem) return;
    setItems((prev) => [...prev, pendingItem]);
    setItemInput('');
  };

  const submit = () => {
    if (!canSubmit) return;
    const all = pendingItem ? [...items, pendingItem] : items;
    const result = addStoreWithItems(tripId, name, all);
    const shownName = existing ? existing.name : name;
    reset();
    onAdded(result, shownName);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>Add a store</Text>
            <Pressable onPress={close} hitSlop={8} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.onPrimary} />
            </Pressable>
          </View>

          <View style={styles.body}>
            <Text style={styles.label}>Store</Text>
            <TextInput
              style={styles.input}
              value={storeName}
              onChangeText={setStoreName}
              placeholder="e.g. Mercury Drug"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            {existing && (
              <Text style={styles.hint}>
                {existing.name} is already in this trip.
                {existing.status === 'done' ? ' It will be reopened.' : ''} Items you add go there.
              </Text>
            )}

            <Text style={styles.label}>What do you need there?</Text>
            <View style={styles.itemRow}>
              <TextInput
                style={[styles.input, styles.itemInput]}
                value={itemInput}
                onChangeText={setItemInput}
                placeholder="Item name"
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={addItem}
              />
              <Pressable
                style={[styles.addButton, !pendingItem && styles.addButtonDisabled]}
                onPress={addItem}
                disabled={!pendingItem}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>
            </View>

            {items.length > 0 && (
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {items.map((item, index) => (
                  <View key={`${item}-${index}`} style={styles.listRow}>
                    <Text style={styles.listText} numberOfLines={1}>
                      {item}
                    </Text>
                    <Pressable
                      hitSlop={8}
                      onPress={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                      accessibilityLabel={`Remove ${item}`}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}

            <Pressable
              style={[styles.submit, !canSubmit && styles.submitDisabled]}
              onPress={submit}
              disabled={!canSubmit}
            >
              <Text style={styles.submitText}>{existing ? 'Add items' : 'Add store'}</Text>
            </Pressable>
            <Text style={styles.footnote}>A store needs at least one item to buy.</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  title: { color: colors.onPrimary, fontSize: 17, fontWeight: '800' },
  body: { padding: 16, gap: 8 },
  label: { fontWeight: '600', color: colors.text, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.field,
  },
  hint: { color: colors.accent, fontSize: 13 },
  itemRow: { flexDirection: 'row', gap: 8 },
  itemInput: { flex: 1 },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  addButtonDisabled: { backgroundColor: colors.primaryDisabled },
  addButtonText: { color: colors.onPrimary, fontWeight: '700' },
  list: { maxHeight: 140 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
  },
  listText: { flex: 1, color: colors.text, fontSize: 15 },
  submit: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: 8,
  },
  submitDisabled: { backgroundColor: colors.primaryDisabled },
  submitText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  footnote: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});