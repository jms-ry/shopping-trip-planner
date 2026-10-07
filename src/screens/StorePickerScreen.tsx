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
import { getPendingAnyStoreCount, getStoresForTrip, reopenStore, StoreRow } from '../db/queries';
import { useLeaveToast } from '../lib/useLeaveToast';
import AddStoreDialog from '../components/AddStoreDialog';

type Props = NativeStackScreenProps<RootStackParamList, 'StorePicker'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 90;
const PEEK = 40; // header height, and how much of each card behind stays visible
const CARD_HEIGHT = 226;
const SCALLOPS = 10;
const MAX_VISIBLE = 3;
const HEADER_COLORS = [colors.primary, '#3bb9c4', '#2a98a3']; // front to back

export default function StorePickerScreen({ navigation, route }: Props) {
  const { tripId } = route.params;
  useLeaveToast(tripId);

  const [stores, setStores] = useState<StoreRow[]>([]);
  const [anyPending, setAnyPending] = useState(0);
  const [order, setOrder] = useState<number[]>([]); // store ids, front card first

  const pan = useRef(new Animated.Value(0)).current;
  const deckSize = useRef(0);

  const [showAddStore, setShowAddStore] = useState(false);

  // Single open store: skip the picker. Runs on mount only.
  useEffect(() => {
    const rows = getStoresForTrip(tripId);
    if (rows.length === 1 && rows[0].status === 'open') {
      navigation.replace('StoreShopping', { tripId, storeId: rows[0].id });
    }
  }, []);

  const load = () => {
    const rows = getStoresForTrip(tripId);
    setStores(rows);
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

  // ---- Card ----
  const renderCardContent = (store: StoreRow, depth: number) => {
    const done = store.status === 'done';
    const allMarked = !done && store.pending === 0;
    const marked = store.total - store.pending;
    const headerText = done ? colors.text : colors.onPrimary;

    return (
      <>
        <View
          style={[styles.header, { backgroundColor: done ? colors.border : HEADER_COLORS[depth] }]}
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

            <View style={styles.facade}>
              <View style={[styles.window, done && styles.windowDone]}>
                <View style={styles.glareWide} />
                <View style={styles.glareThin} />
                {done ? (
                  <>
                    <Ionicons name="checkmark-circle" size={44} color={colors.success} />
                    <Text style={styles.windowLabel}>Done</Text>
                  </>
                ) : allMarked ? (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={44} color={colors.accent} />
                    <Text style={styles.windowLabel}>All marked</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.windowBig}>{store.pending}</Text>
                    <Text style={styles.windowLabel}>
                      item{store.pending === 1 ? '' : 's'} left
                    </Text>
                  </>
                )}
                {!done && marked > 0 && (
                  <Text style={styles.windowSmall}>
                    {marked} of {store.total} marked
                  </Text>
                )}
              </View>

              <Pressable
                style={[styles.door, done && styles.doorClosed]}
                onPress={() => (done ? reopen(store) : openStore(store))}
                accessibilityLabel={done ? `Reopen ${store.name}` : `Shop at ${store.name}`}
              >
                <View style={[styles.sign, done && styles.signClosed]}>
                  <Text style={styles.signText}>{done ? 'CLOSED' : 'OPEN'}</Text>
                </View>
                <View style={styles.doorGlass} />
                <View style={styles.doorRow}>
                  <Text style={styles.doorLabel}>
                    {done ? 'Reopen' : store.pending > 0 ? 'Shop here' : 'Finish'}
                  </Text>
                  <Ionicons
                    name={done ? 'refresh' : 'arrow-forward'}
                    size={16}
                    color={colors.onPrimary}
                  />
                </View>
                <View style={styles.knob} />
              </Pressable>
            </View>

            <View style={styles.ground} />
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
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>
          {openCount === 0 ? 'All stores done' : anyDone ? 'Where to next?' : 'Where to start?'}
        </Text>
        <Text style={styles.subtitle}>
          {openCount === 0
            ? 'Reopen a store to make changes.'
            : `${openCount} of ${stores.length} store${stores.length === 1 ? '' : 's'} left`}
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
        {openCount === 0 && (
          <Pressable
            style={styles.reviewButton}
            onPress={() => navigation.replace('Review', { tripId })}
          >
            <Text style={styles.reviewButtonText}>Back to review</Text>
          </Pressable>
        )}
        <Pressable style={styles.addStoreButton} onPress={() => setShowAddStore(true)}>
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={styles.addStoreText}>Add a store</Text>
        </Pressable>
        <View style={styles.spacerBottom} />
      </ScrollView>
      <AddStoreDialog
        visible={showAddStore}
        tripId={tripId}
        onClose={() => setShowAddStore(false)}
        onAdded={(result) => {
          setShowAddStore(false);
          load();
          bringToFront(result.storeId);
        }}
      />
    </>
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

  // Shop front
  facade: { flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingTop: 14 },
  window: {
    flex: 1.5,
    height: 128,
    borderRadius: 12,
    borderWidth: 4,
    borderColor: colors.accent,
    backgroundColor: '#DDF6F9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  windowDone: { borderColor: colors.border, backgroundColor: colors.muted },
  glareWide: {
    position: 'absolute',
    top: 8,
    left: 22,
    width: 12,
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.7)',
    transform: [{ rotate: '25deg' }],
  },
  glareThin: {
    position: 'absolute',
    top: 8,
    left: 42,
    width: 5,
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.7)',
    transform: [{ rotate: '25deg' }],
  },
  windowBig: { fontSize: 40, fontWeight: '800', color: colors.text, lineHeight: 44 },
  windowLabel: { color: colors.textMuted, fontWeight: '600' },
  windowSmall: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

  door: {
    flex: 1,
    height: 128,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  doorClosed: { backgroundColor: colors.border },
  sign: {
    position: 'absolute',
    top: 14,
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  signClosed: { backgroundColor: colors.neutral },
  signText: { color: colors.textOnDark, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  doorGlass: {
    position: 'absolute',
    top: 42,
    width: 38,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  doorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doorLabel: { color: colors.onPrimary, fontWeight: '800', fontSize: 14 },
  knob: {
    position: 'absolute',
    right: 8,
    top: 84,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.onPrimary,
  },
  ground: {
    height: 6,
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 3,
    backgroundColor: colors.muted,
  },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { width: 20, backgroundColor: colors.primary },
  hint: { color: colors.mutedOnDark, textAlign: 'center', fontSize: 12, marginTop: 8 },
  reviewButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: 20,
  },
  reviewButtonText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  addStoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 20,
  },
  addStoreText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
});