import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { colors, radius } from '../theme';
import { createTrip, DraftItem, getToBuyById } from '../db/queries';
import { startTripSession } from '../lib/tripSession';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SheetBottomInset from '../components/SheetBottomInset';

type Props = NativeStackScreenProps<RootStackParamList, 'Plan'>;
type ToastKind = 'added' | 'removed';

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
  const [showCart, setShowCart] = useState(false);

  // Flash message
  const [toast, setToast] = useState<{ message: string; kind: ToastKind }>({
    message: '',
    kind: 'added',
  });
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = (message: string, kind: ToastKind) => {
    setToast({ message, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastAnim.stopAnimation();
    Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }, 2000);
  };

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
    showToast(`${name} added to cart!`, 'added');
    // Store and the Any store switch stay as they are: users often add several items per store.
  };

  const removeItem = (index: number) => {
    const removed = items[index];
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (items.length === 1) setShowCart(false); // removed the last item
    showToast(`${removed.name} removed from cart`, 'removed');
  };

  const proceed = () => {
    const tripId = createTrip(items, toBuyId !== undefined ? [toBuyId] : []);
    startTripSession(tripId, true);
    navigation.replace('TripLoading', { tripId });
  };

  // Newest first. `index` is the position in `items`, which removal needs.
  const entries = items.map((item, index) => ({ item, index })).reverse();
  const preview = entries.slice(0, 3);

  const renderCartRow = (entry: { item: DraftItem; index: number }, position: number) => (
    <View
      key={`${entry.item.name}-${entry.index}`}
      style={[styles.cartRow, position > 0 && styles.rowDivider]}
    >
      <View style={styles.cartRowText}>
        <Text style={styles.itemName}>{entry.item.name}</Text>
        <View style={styles.storeTag}>
          <Ionicons
            name={entry.item.storeName ? 'storefront-outline' : 'shuffle'}
            size={13}
            color={colors.textMuted}
          />
          <Text style={styles.storeTagText}>{entry.item.storeName ?? 'Any store'}</Text>
        </View>
      </View>
      <Pressable
        onPress={() => removeItem(entry.index)}
        hitSlop={8}
        accessibilityLabel={`Remove ${entry.item.name}`}
      >
        <Ionicons name="trash-outline" size={20} color={colors.danger} />
      </Pressable>
    </View>
  );

  const toastView = (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        toast.kind === 'removed' && styles.toastRemoved,
        {
          opacity: toastAnim,
          transform: [
            { translateX: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
          ],
        },
      ]}
    >
      <Ionicons
        name={toast.kind === 'removed' ? 'trash' : 'checkmark-circle'}
        size={20}
        color={colors.onColor}
      />
      <Text style={styles.toastText} numberOfLines={1}>
        {toast.message}
      </Text>
    </Animated.View>
  );
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          <Text style={styles.label}>Item</Text>
          <TextInput
            style={styles.input}
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="e.g. Cooking oil"
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
          />

          <Text style={styles.label}>Store</Text>
          <TextInput
            style={[styles.input, anyStore && styles.inputDisabled]}
            value={anyStore ? '' : storeInput}
            onChangeText={setStoreInput}
            placeholder={anyStore ? 'Any store' : 'e.g. Palengke'}
            placeholderTextColor={colors.textMuted}
            editable={!anyStore}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Any store</Text>
            <Switch
              value={anyStore}
              onValueChange={setAnyStore}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>

          <Pressable style={styles.addButton} onPress={addItem}>
            <Ionicons name="cart" size={18} color={colors.onColor} />
            <Text style={styles.addButtonText}>Add to cart</Text>
          </Pressable>
        </View>

        {/* Cart: handle, body, wheels */}
        <View style={styles.cartHandle} />
        <View style={styles.cartBody}>
          <View style={styles.cartHeader}>
            <Ionicons name="cart" size={20} color={colors.onColor} />
            <Text style={styles.cartTitle}>Cart</Text>
            <View style={styles.cartCount}>
              <Text style={styles.cartCountText}>{items.length}</Text>
            </View>
          </View>

          {items.length === 0 ? (
            <View style={styles.cartEmpty}>
              <Ionicons name="cart-outline" size={34} color={colors.textMuted} />
              <Text style={styles.cartEmptyText}>Your cart is empty. Add items above.</Text>
            </View>
          ) : (
            <>
              {preview.map((entry, position) => renderCartRow(entry, position))}
              {items.length > 3 && (
                <Pressable style={[styles.viewAllRow, styles.rowDivider]} onPress={() => setShowCart(true)}>
                  <Text style={styles.viewAllText}>View full cart ({items.length})</Text>
                  <Ionicons name="chevron-up" size={18} color={colors.accent} />
                </Pressable>
              )}
            </>
          )}
        </View>
        <View style={styles.wheels}>
          <View style={styles.wheel} />
          <View style={styles.wheel} />
        </View>

        {!canProceed && items.length > 0 && (
          <Text style={styles.hint}>At least one item needs a store name.</Text>
        )}

        <Pressable
          style={[styles.proceedButton, !canProceed && styles.proceedDisabled]}
          onPress={proceed}
          disabled={!canProceed}
        >
          <Text style={[styles.proceedText, !canProceed && styles.proceedTextDisabled]}>
            Proceed shopping
          </Text>
          <Ionicons
            name="arrow-forward"
            size={18}
            color={canProceed ? colors.onColor : colors.onDisabled}
          />
        </Pressable>
      </ScrollView>

      {!showCart && toastView}

      <Modal
        visible={showCart}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCart(false)}
      >
        <SafeAreaProvider>
          <View style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCart(false)} />
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Ionicons name="cart" size={20} color={colors.onColor} />
                <Text style={styles.cartTitle}>Cart</Text>
                <View style={styles.cartCount}>
                  <Text style={styles.cartCountText}>{items.length}</Text>
                </View>
                <Pressable onPress={() => setShowCart(false)} hitSlop={8} accessibilityLabel="Close cart">
                  <Ionicons name="close" size={24} color={colors.onColor} />
                </Pressable>
              </View>

              <ScrollView style={styles.sheetList}>
                {entries.map((entry, position) => renderCartRow(entry, position))}
              </ScrollView>

              <Pressable style={styles.sheetDone} onPress={() => setShowCart(false)}>
                <Text style={styles.sheetDoneText}>Done</Text>
              </Pressable>
              <SheetBottomInset/>
            </View>
            {toastView}
          </View>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { padding: 16, paddingBottom: 48 },

  formCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border },
  label: { fontWeight: '600', marginBottom: 6, marginTop: 8, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.field,
  },
  inputDisabled: { backgroundColor: colors.muted },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  switchLabel: { fontSize: 16, color: colors.text },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: radius.md,
    marginTop: 14,
  },
  addButtonText: { color: colors.onColor, fontWeight: '700', fontSize: 16 },

  cartHandle: {
    alignSelf: 'flex-start',
    marginLeft: 28,
    marginTop: 24,
    width: 64,
    height: 18,
    borderWidth: 4,
    borderBottomWidth: 0,
    borderColor: colors.accent,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  cartBody: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    minHeight: 140,
    borderWidth: 1, 
    borderColor: colors.border
  },
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  cartTitle: { color: colors.onColor, fontSize: 17, fontWeight: '800' },
  cartCount: {
    marginLeft: 'auto',
    backgroundColor: colors.onColor,
    borderRadius: 12,
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: 'center',
  },
  cartCountText: { color: colors.accent, fontWeight: '800' },
  cartEmpty: { alignItems: 'center', gap: 8, padding: 24 },
  cartEmptyText: { color: colors.textMuted, textAlign: 'center' },
  cartRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.muted },
  cartRowText: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: colors.text },
  storeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  storeTagText: { color: colors.textMuted, fontSize: 13 },
  wheels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 40,
    marginTop: 6,
  },
  wheel: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 5,
    borderColor: colors.accent,
    backgroundColor: colors.background,
  },

  hint: { color: colors.warning, marginTop: 16 },
  proceedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    padding: 16,
    borderRadius: radius.md,
    marginTop: 24,
  },
  proceedDisabled: { backgroundColor: colors.primaryDisabled },
  proceedText: { color: colors.onColor, fontSize: 16, fontWeight: '700' },
  proceedTextDisabled: { color: colors.onDisabled },

  toast: {
    position: 'absolute',
    top: 12,
    right: 16,
    maxWidth: '80%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.success,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  toastText: { color: colors.onColor, fontWeight: '700', flexShrink: 1 },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
  },
  viewAllText: { color: colors.accent, fontWeight: '700' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetList: { flexShrink: 1 },
  sheetDone: {
    backgroundColor: colors.accent,
    margin: 16,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  sheetDoneText: { color: colors.onColor, fontWeight: '700', fontSize: 16 },
  toastRemoved: { backgroundColor: colors.danger },
});