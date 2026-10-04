import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import ProgressBar from '../components/ProgressBar';
import { colors, radius } from '../theme';
import {
  addOrReopenStore,
  addUnplannedItem,
  deleteUnplannedItem,
  getItemsForStore,
  getOtherOpenStoreCount,
  getStoreById,
  ItemStatus,
  markStoreDone,
  moveLeftoversToNoStock,
  setItemStatus,
  ShopItem,
} from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'StoreShopping'>;
type IconName = keyof typeof Ionicons.glyphMap;

const PAGE_SIZE = 4;
const SCALLOPS = 10;

const STATUS_META: Record<ItemStatus, { label: string; color: string; icon: IconName }> = {
  pending: { label: 'Mark', color: colors.neutral, icon: 'ellipse-outline' },
  bought: { label: 'Bought', color: colors.success, icon: 'checkmark-circle' },
  no_stock: { label: 'No stock', color: colors.warning, icon: 'alert-circle' },
  skipped: { label: 'Skipped', color: colors.neutral, icon: 'remove-circle' },
};

const OPTIONS: { status: Exclude<ItemStatus, 'pending'>; label: string }[] = [
  { status: 'bought', label: 'Bought' },
  { status: 'no_stock', label: 'No stock' },
  { status: 'skipped', label: 'Skip' },
];

const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

export default function StoreShoppingScreen({ navigation, route }: Props) {
  const { tripId, storeId } = route.params;

  const [items, setItems] = useState<ShopItem[]>([]);
  const [storeName, setStoreName] = useState('');

  // Pager
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);

  // Modals
  const [markId, setMarkId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [showLeftover, setShowLeftover] = useState(false);
  const [extraStore, setExtraStore] = useState('');

  const load = () => {
    setItems(getItemsForStore(tripId, storeId));
    const store = getStoreById(storeId);
    if (store) setStoreName(store.name);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [tripId, storeId])
  );

  // ---- Derived data ----
  const pages: ShopItem[][] = [];
  for (let i = 0; i < items.length; i += PAGE_SIZE) pages.push(items.slice(i, i + PAGE_SIZE));
  const pageCount = pages.length;

  const markItem = items.find((i) => i.id === markId) ?? null;
  const ownItems = items.filter((i) => i.store_id !== null);
  const ownMarked = ownItems.filter((i) => i.status !== 'pending').length;
  const pendingOwn = ownItems.length - ownMarked;
  const canFinish = pendingOwn === 0;
  const leftoverAny = items.filter((i) => i.store_id === null && i.status === 'pending');

  // If items are removed and the current page no longer exists, go to the last one.
  useEffect(() => {
    if (pageCount > 0 && page > pageCount - 1) {
      const last = pageCount - 1;
      setPage(last);
      scrollRef.current?.scrollTo({ x: last * pageWidth, animated: false });
    }
  }, [pageCount]);

  const goToPage = (index: number) => {
    setPage(index);
    setTimeout(() => scrollRef.current?.scrollTo({ x: index * pageWidth, animated: true }), 60);
  };

  // ---- Marking ----
  const mark = (item: ShopItem, status: Exclude<ItemStatus, 'pending'>) => {
    // Any-store items remember where they were resolved.
    setItemStatus(item.id, status, item.store_id === null ? storeId : null);
    setMarkId(null);
    load();
  };

  const clearMark = (item: ShopItem) => {
    setItemStatus(item.id, 'pending', null);
    setMarkId(null);
    load();
  };

  const removeUnplanned = (item: ShopItem) => {
    deleteUnplannedItem(item.id);
    setMarkId(null);
    load();
  };

  // ---- Unplanned items ----
  const closeAdd = () => {
    setShowAdd(false);
    setNewItem('');
    setLastAdded(null);
  };

  const addUnplanned = () => {
    const name = clean(newItem);
    if (!name) return;
    addUnplannedItem(tripId, storeId, name);
    setNewItem('');
    setLastAdded(name);
    goToPage(Math.floor(items.length / PAGE_SIZE)); // page that will hold the new item
    load();
  };

  // ---- Finishing the store ----
  const goToPickerOrBack = () => {
    const routes = navigation.getState().routes;
    const previous = routes[routes.length - 2];
    if (previous?.name === 'StorePicker') {
      navigation.goBack();
    } else {
      navigation.replace('StorePicker', { tripId });
    }
  };

  const finishStore = () => {
    if (getOtherOpenStoreCount(tripId, storeId) > 0) {
      markStoreDone(storeId);
      goToPickerOrBack();
    } else if (leftoverAny.length > 0) {
      setShowLeftover(true); // last store, but any-store items remain
    } else {
      markStoreDone(storeId);
      navigation.replace('Review', { tripId });
    }
  };

  const addAnotherStore = () => {
    const name = clean(extraStore);
    if (!name) return;
    markStoreDone(storeId);
    const newStoreId = addOrReopenStore(tripId, name);
    setShowLeftover(false);
    setExtraStore('');
    navigation.replace('StoreShopping', { tripId, storeId: newStoreId });
  };

  const sendLeftoversToBuyList = () => {
    moveLeftoversToNoStock(tripId, storeId);
    markStoreDone(storeId);
    setShowLeftover(false);
    navigation.replace('Review', { tripId });
  };

  // ---- Rendering ----
  const renderItemCard = (item: ShopItem) => {
    const meta = STATUS_META[item.status];
    const pending = item.status === 'pending';
    return (
      <View key={item.id} style={styles.itemCard}>
        <Ionicons name={meta.icon} size={26} color={pending ? colors.border : meta.color} />
        <View style={styles.itemText}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.store_id === null && <Text style={styles.tag}>Any store</Text>}
          {item.is_unplanned === 1 && <Text style={styles.tag}>Unplanned</Text>}
        </View>
        {pending ? (
          <Pressable style={styles.markButton} onPress={() => setMarkId(item.id)}>
            <Text style={styles.markButtonText}>Mark</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.statusPill, { backgroundColor: meta.color }]}
            onPress={() => setMarkId(item.id)}
          >
            <Text style={styles.statusPillText}>{meta.label}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.spacerTop} />
        <View style={styles.storeCard}>
          <View style={styles.storeHeader}>
            <View style={styles.storeTitleWrap}>
              <Ionicons name="storefront" size={22} color={colors.onPrimary} />
              <Text style={styles.storeTitle} numberOfLines={1}>
                {storeName}
              </Text>
            </View>
            <Pressable style={styles.addPill} onPress={() => setShowAdd(true)}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.addPillText}>Add item</Text>
            </Pressable>
          </View>

          <View style={styles.awning}>
            {Array.from({ length: SCALLOPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.scallop,
                  { backgroundColor: i % 2 === 0 ? colors.primary : colors.tint },
                ]}
              />
            ))}
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyStore}>
              <Ionicons name="basket-outline" size={34} color={colors.textMuted} />
              <Text style={styles.emptyText}>No items for this store yet. Use Add item above.</Text>
            </View>
          ) : (
            <>
              <ScrollView
                ref={scrollRef}
                style={styles.pager}
                horizontal
                pagingEnabled
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
                onMomentumScrollEnd={(e) => {
                  if (pageWidth > 0) {
                    setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
                  }
                }}
              >
                {pages.map((pageItems, pageIndex) => (
                  <View key={pageIndex} style={{ width: pageWidth }}>
                    {pageItems.map(renderItemCard)}
                  </View>
                ))}
              </ScrollView>

              {pageCount > 1 && (
                <>
                  <View style={styles.dots}>
                    {pages.map((_, i) => (
                      <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
                    ))}
                  </View>
                  {page === 0 && <Text style={styles.swipeHint}>Swipe to see more</Text>}
                </>
              )}
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {ownMarked} of {ownItems.length} store items marked
            </Text>
            <ProgressBar value={ownMarked} total={ownItems.length} color={colors.success} />
          </View>
        </View>

        {pendingOwn > 0 && (
          <Text style={styles.hint}>
            {pendingOwn} item{pendingOwn === 1 ? '' : 's'} left to mark.
          </Text>
        )}
        {pendingOwn === 0 && leftoverAny.length > 0 && (
          <Text style={styles.note}>
            {leftoverAny.length} any-store item{leftoverAny.length === 1 ? '' : 's'} not marked yet.
            They move on with you.
          </Text>
        )}

        <Pressable
          style={[styles.doneButton, !canFinish && styles.doneDisabled]}
          onPress={finishStore}
          disabled={!canFinish}
        >
          <Text style={[styles.doneText, !canFinish && styles.doneTextDisabled]}>
            Done with this store
          </Text>
          <Ionicons
            name="checkmark"
            size={20}
            color={canFinish ? colors.onPrimary : colors.mutedOnDark}
          />
        </Pressable>
        <View style={styles.spacerTop} />
      </ScrollView>

      {/* Mark modal */}
      <Modal
        visible={markItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setMarkId(null)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMarkId(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {markItem?.name}
              </Text>
              <Pressable onPress={() => setMarkId(null)} hitSlop={8} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.onPrimary} />
              </Pressable>
            </View>

            <View style={styles.markBody}>
              {OPTIONS.map((opt) => {
                const meta = STATUS_META[opt.status];
                const selected = markItem?.status === opt.status;
                return (
                  <Pressable
                    key={opt.status}
                    style={[
                      styles.markOption,
                      { borderColor: meta.color },
                      selected && { backgroundColor: meta.color },
                    ]}
                    onPress={() => markItem && mark(markItem, opt.status)}
                  >
                    <Ionicons
                      name={meta.icon}
                      size={24}
                      color={selected ? colors.textOnDark : meta.color}
                    />
                    <Text
                      style={[
                        styles.markOptionText,
                        { color: selected ? colors.textOnDark : meta.color },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}

              {markItem && markItem.status !== 'pending' && (
                <Pressable style={styles.sheetLink} onPress={() => clearMark(markItem)}>
                  <Text style={styles.sheetLinkText}>Clear mark</Text>
                </Pressable>
              )}
              {markItem?.is_unplanned === 1 && (
                <Pressable style={styles.sheetLink} onPress={() => removeUnplanned(markItem)}>
                  <Text style={[styles.sheetLinkText, { color: colors.danger }]}>Remove item</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Add item modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={closeAdd}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeAdd} />
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <Text style={styles.sheetTitle}>Add item</Text>
              <Pressable onPress={closeAdd} hitSlop={8} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.onPrimary} />
              </Pressable>
            </View>
            <View style={styles.dialogBody}>
              <Text style={styles.dialogHint}>
                Bought something that wasn't on your list? It is saved as bought at {storeName}.
              </Text>
              <TextInput
                style={styles.modalInput}
                value={newItem}
                onChangeText={setNewItem}
                placeholder="Item name"
                placeholderTextColor={colors.textMuted}
                autoFocus
                onSubmitEditing={addUnplanned}
              />
              {lastAdded && <Text style={styles.addedText}>✓ {lastAdded} added</Text>}
              <Pressable
                style={[styles.modalPrimary, !clean(newItem) && styles.primaryDisabled]}
                onPress={addUnplanned}
                disabled={!clean(newItem)}
              >
                <Text style={styles.modalPrimaryText}>Add item</Text>
              </Pressable>
              <Pressable style={styles.sheetLink} onPress={closeAdd}>
                <Text style={styles.sheetLinkText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Leftover any-store items on the last store */}
      <Modal
        visible={showLeftover}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLeftover(false)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Items still unmarked</Text>
            <Text style={styles.modalBody}>{leftoverAny.map((i) => i.name).join(', ')}</Text>
            <Text style={styles.modalBody}>Going to another store?</Text>
            <TextInput
              style={styles.modalInput}
              value={extraStore}
              onChangeText={setExtraStore}
              placeholder="Store name"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable
              style={[styles.modalPrimary, !extraStore.trim() && styles.primaryDisabled]}
              onPress={addAnotherStore}
              disabled={!extraStore.trim()}
            >
              <Text style={styles.modalPrimaryText}>Add store and continue</Text>
            </Pressable>
            <Pressable style={styles.modalSecondary} onPress={sendLeftoversToBuyList}>
              <Text style={styles.modalSecondaryText}>Move to To buy list</Text>
            </Pressable>
            <Pressable style={styles.modalCancel} onPress={() => setShowLeftover(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, flexGrow: 1 },
  spacerTop: { flex: 1 },
  spacerBottom: { flex: 1.5 },

  // Store card
  storeCard: { backgroundColor: colors.surface, borderRadius: radius.lg },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  storeTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  storeTitle: { color: colors.onPrimary, fontSize: 18, fontWeight: '800', flexShrink: 1 },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.onPrimary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  addPillText: { color: colors.primary, fontWeight: '700' },
  awning: { flexDirection: 'row' },
  scallop: {
    flex: 1,
    height: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  pager: { marginTop: 12, marginHorizontal: 12 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.field,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    minHeight: 64,
  },
  itemText: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: colors.text },
  tag: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  markButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    minWidth: 88,
    alignItems: 'center',
  },
  markButtonText: { color: colors.onPrimary, fontWeight: '700' },
  statusPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    minWidth: 88,
    alignItems: 'center',
  },
  statusPillText: { color: colors.textOnDark, fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 20, backgroundColor: colors.accent },
  swipeHint: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: 6 },
  emptyStore: { alignItems: 'center', gap: 8, padding: 28 },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  footer: { padding: 14, paddingTop: 12, gap: 6 },
  footerText: { color: colors.textMuted },

  // Under the card
  hint: { color: colors.amber, marginTop: 16 },
  note: { color: colors.mutedOnDark, marginTop: 16 },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: radius.md,
    marginTop: 20,
  },
  doneDisabled: { backgroundColor: 'rgba(86,226,236,0.2)' },
  doneText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  doneTextDisabled: { color: colors.mutedOnDark },

  // Bottom sheet (mark)
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetTitle: { color: colors.onPrimary, fontSize: 17, fontWeight: '800', flexShrink: 1 },
  markBody: { padding: 16, gap: 10 },
  markOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderRadius: radius.md,
  },
  markOptionText: { fontSize: 17, fontWeight: '700' },
  sheetLink: { alignItems: 'center', paddingVertical: 10 },
  sheetLinkText: { color: colors.accent, fontWeight: '600', fontSize: 16 },

  // Centered dialog (add item)
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.lg },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  dialogBody: { padding: 16, gap: 10 },
  dialogHint: { color: colors.textMuted },
  addedText: { color: colors.success, fontWeight: '600' },

  // Shared by the add and leftover dialogs
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.field,
  },
  modalPrimary: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryDisabled: { backgroundColor: colors.primaryDisabled },
  modalPrimaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },

  // Leftover dialog
  modalBox: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalBody: { color: '#333' },
  modalSecondary: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalSecondaryText: { color: colors.accent, fontWeight: '600' },
  modalCancel: {
    backgroundColor: colors.amber,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalCancelText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
});