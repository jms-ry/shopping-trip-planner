import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { colors, radius } from '../theme';
import {
  getPendingAnyStoreCount,
  getStorePendingItems,
  getStoresForTrip,
  reopenStore,
  StoreRow,
} from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'StorePicker'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 90;
const PEEK = 40; // header height, and how much of each card behind stays visible
const CARD_HEIGHT = 290;
const ROW_H = 26;
const SCALLOPS = 10;
const MAX_VISIBLE = 3;
const HEADER_COLORS = [colors.primary, '#3bb9c4', '#2a98a3']; // front to back

export default function StorePickerScreen({ navigation, route }: Props) {
  const { tripId } = route.params;
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [pendingNames, setPendingNames] = useState<Map<number, string[]>>(new Map());
  const [anyPending, setAnyPending] = useState(0);
  const [order, setOrder] = useState<number[]>([]); // store ids, front card first

  const pan = useRef(new Animated.Value(0)).current;
  const deckSize = useRef(0);

  // Single open store: skip the picker. Runs on mount only.
  useEffect(() => {
    const rows = getStoresForTrip(tripId);
    if (rows.length === 1 && rows[0].status === 'open') {
      navigation.replace('StoreShopping', { tripId, storeId: rows[0].id });
    }
  }, []);

  const load = () => {
    const rows = getStoresForTrip(tripId);
    const grouped = new Map<number, string[]>();
    for (const r of getStorePendingItems(tripId)) {
      grouped.set(r.store_id, [...(grouped.get(r.store_id) ?? []), r.name]);
    }
    setStores(rows);
    setPendingNames(grouped);
    setAnyPending(getPendingAnyStoreCount(tripId));

    // Keep the current deck order, add new stores at the back,
    // and sink finished stores behind the open ones.
    setOrder((prev) => {
      const ids = rows.map((r) => r.id);
      const kept = prev.filter((id) => ids.includes(id));
      const merged = [...kept, ...ids.filter((id) => !kept.includes(id))];
      const status = new Map(rows.map((r) => [r.id, r.status]));
      return [
        ...merged.filter((id) => status.get(id) === 'open'),
        ...merged.filter((id) => status.get(id) === 'done'),
      ];
    });
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [tripId])
  );

  const byId = new Map(stores.map((s) => [s.id, s]));
  const deck = order.map((id) => byId.get(id)).filter((s): s is StoreRow => s !== undefined);
  deckSize.current = deck.length;

  // The front card moved off-screen and the deck rotated: put the next card at rest.
  useLayoutEffect(() => {
    pan.setValue(0);
  }, [order]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        deckSize.current > 1 && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: Animated.event([null, { dx: pan }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > SWIPE_THRESHOLD || Math.abs(g.vx) > 0.8) {
          const direction = g.dx > 0 ? 1 : -1;
          Animated.timing(pan, {
            toValue: direction * SCREEN_WIDTH * 1.3,
            duration: 180,
            useNativeDriver: false,
          }).start(() => {
            setOrder((prev) => (prev.length > 1 ? [...prev.slice(1), prev[0]] : prev));
          });
        } else {
          Animated.spring(pan, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const bringToFront = (id: number) => {
    setOrder((prev) => [id, ...prev.filter((x) => x !== id)]);
  };

  const openStore = (store: StoreRow) => {
    navigation.navigate('StoreShopping', { tripId, storeId: store.id });
  };

  const reopen = (store: StoreRow) => {
    reopenStore(store.id);
    load();
  };

  const openCount = stores.filter((s) => s.status === 'open').length;
  const anyDone = stores.some((s) => s.status === 'done');

  // ---- Card pieces ----
  const renderBullet = (name: string, i: number) => (
    <View key={`${name}-${i}`} style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );

  const renderItemColumns = (names: string[]) => {
    const total = names.length;
    const col1 = names.slice(0, 5);
    const col2 = total > 10 ? names.slice(5, 9) : names.slice(5, 10);
    const extra = total > 10 ? total - 9 : 0;
    return (
      <View style={styles.columns}>
        <View style={styles.column}>{col1.map(renderBullet)}</View>
        <View style={styles.column}>
          {col2.map(renderBullet)}
          {extra > 0 && (
            <View style={styles.bulletRow}>
              <Text style={styles.moreText}>+{extra} more items</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderCardContent = (store: StoreRow, depth: number) => {
    const done = store.status === 'done';
    const names = pendingNames.get(store.id) ?? [];
    const marked = store.total - store.pending;
    const headerText = done ? colors.text : colors.onPrimary;

    return (
      <>
        <View
          style={[
            styles.header,
            { backgroundColor: done ? colors.border : HEADER_COLORS[depth] },
          ]}
        >
          <View style={styles.headerLeft}>
            <Ionicons name="storefront" size={20} color={headerText} />
            <Text style={[styles.storeName, { color: headerText }]} numberOfLines={1}>
              {store.name}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {done ? 'Done' : store.pending > 0 ? `${store.pending} left` : 'All marked'}
            </Text>
          </View>
        </View>

        {depth === 0 && (
          <>
            <View style={styles.awning}>
              {Array.from({ length: SCALLOPS }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.scallop,
                    {
                      backgroundColor: done
                        ? i % 2 === 0
                          ? colors.border
                          : colors.muted
                        : i % 2 === 0
                        ? colors.primary
                        : colors.tint,
                    },
                  ]}
                />
              ))}
            </View>

            {done ? (
              <View style={styles.listArea}>
                <View style={styles.doneBody}>
                  <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                  <Text style={styles.doneTitle}>Done</Text>
                  <Text style={styles.doneMeta}>
                    {store.total} item{store.total === 1 ? '' : 's'} handled
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.listArea}>
                {names.length === 0 ? (
                  <View style={styles.doneBody}>
                    <Ionicons name="checkmark-circle-outline" size={34} color={colors.textMuted} />
                    <Text style={styles.doneMeta}>All items marked</Text>
                  </View>
                ) : (
                  renderItemColumns(names)
                )}
              </View>
            )}

            <View style={styles.footer}>
              {!done && marked > 0 && (
                <Text style={styles.footerText}>
                  {marked} of {store.total} marked
                </Text>
              )}
              {done ? (
                <Pressable style={styles.reopenButton} onPress={() => reopen(store)}>
                  <Text style={styles.reopenText}>Reopen</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.shopButton} onPress={() => openStore(store)}>
                  <Text style={styles.shopText}>
                    {store.pending > 0 ? 'Shop here' : 'Finish store'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
                </Pressable>
              )}
            </View>
          </>
        )}
      </>
    );
  };

  // ---- Deck ----
  const visible = deck.slice(0, MAX_VISIBLE);
  const behind = Math.max(0, visible.length - 1);

  const renderCard = (store: StoreRow, depth: number) => {
    const placement = {
      position: 'absolute' as const,
      top: (behind - depth) * PEEK,
      left: depth * 10,
      right: depth * 10,
      height: CARD_HEIGHT,
    };

    if (depth === 0) {
      return (
        <Animated.View
          key={store.id}
          style={[
            styles.card,
            placement,
            {
              transform: [
                { translateX: pan },
                {
                  rotate: pan.interpolate({
                    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                    outputRange: ['-12deg', '0deg', '12deg'],
                  }),
                },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {renderCardContent(store, 0)}
        </Animated.View>
      );
    }

    return (
      <Pressable
        key={store.id}
        style={[styles.card, placement]}
        onPress={() => bringToFront(store.id)}
        accessibilityLabel={`Show ${store.name}`}
      >
        {renderCardContent(store, depth)}
      </Pressable>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{anyDone ? 'Where to next?' : 'Where to start?'}</Text>
      <Text style={styles.subtitle}>
        {openCount} of {stores.length} store{stores.length === 1 ? '' : 's'} left
      </Text>

      {anyPending > 0 && (
        <View style={styles.anyNote}>
          <Ionicons name="shuffle" size={16} color={colors.primary} />
          <Text style={styles.anyNoteText}>
            {anyPending} any-store item{anyPending === 1 ? '' : 's'} will follow you from stop to
            stop
          </Text>
        </View>
      )}
      <View style={styles.spacerTop} />
      <View style={[styles.deck, { height: PEEK * behind + CARD_HEIGHT }]}>
        {visible
          .map((store, depth) => ({ store, depth }))
          .reverse() // deepest first, so the front card is drawn last
          .map(({ store, depth }) => renderCard(store, depth))}
      </View>

      {deck.length > 1 && (
        <>
          <View style={styles.dots}>
            {stores.map((s) => (
              <View key={s.id} style={[styles.dot, s.id === deck[0]?.id && styles.dotActive]} />
            ))}
          </View>
          <Text style={styles.hint}>Swipe the card, or tap a card behind it</Text>
        </>
      )}
      <View style={styles.spacerBottom} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, flexGrow: 1 },
  spacerTop: { flex: 1 },
  spacerBottom: { flex: 1.5 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textOnDark },
  subtitle: { color: colors.mutedOnDark, marginTop: 4, marginBottom: 16 },
  anyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(86,226,236,0.12)',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  anyNoteText: { color: colors.textOnDark, flex: 1 },

  deck: { marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg },
  header: {
    height: PEEK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  storeName: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  badge: {
    backgroundColor: colors.onPrimary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  awning: { flexDirection: 'row' },
  scallop: {
    flex: 1,
    height: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },

  listArea: { height: 12 + ROW_H * 5 + 8, paddingHorizontal: 16, paddingTop: 12 },
  columns: { flexDirection: 'row', gap: 12 },
  column: { flex: 1 },
  bulletRow: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 6 },
  bullet: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  bulletText: { flex: 1, color: colors.text, fontSize: 15 },
  moreText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  doneBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  doneTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  doneMeta: { color: colors.textMuted },

  footer: { marginTop: 'auto', paddingHorizontal: 14, paddingBottom: 14, gap: 6 },
  footerText: { color: colors.textMuted, fontSize: 12 },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  shopText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  reopenButton: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  reopenText: { color: colors.accent, fontSize: 16, fontWeight: '700' },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { width: 20, backgroundColor: colors.primary },
  hint: { color: colors.mutedOnDark, textAlign: 'center', fontSize: 12, marginTop: 8 },
});