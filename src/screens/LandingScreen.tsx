import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import ProgressBar from '../components/ProgressBar';
import { colors, radius } from '../theme';
import {
  deleteToBuy,
  discardTrip,
  endTripEarly,
  getCompletedTrips,
  getInProgressTrips,
  getToBuy,
  InProgressTrip,
  ToBuyRow,
  TripRow,
} from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;
type ViewAllSection = 'progress' | 'toBuy' | 'journeys';
type ToastKind = 'success' | 'destroy';

const PREVIEW_COUNT = 3;

export default function LandingScreen({ navigation, route }: Props) {
  const [inProgress, setInProgress] = useState<InProgressTrip[]>([]);
  const [toBuy, setToBuy] = useState<ToBuyRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [viewAll, setViewAll] = useState<ViewAllSection | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: ToastKind }>({
    message: '',
    kind: 'success',
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

  useEffect(() => {
    if (route.params?.saved) {
      showToast('Trip saved to journeys', 'success');
      navigation.setParams({ saved: undefined });
    }
  }, [route.params?.saved]);
  const load = () => {
    setInProgress(getInProgressTrips());
    setToBuy(getToBuy());
    setTrips(getCompletedTrips());
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  // Close the sheet when the list it shows becomes empty.
  useEffect(() => {
    if (viewAll === 'progress' && inProgress.length === 0) setViewAll(null);
    if (viewAll === 'toBuy' && toBuy.length === 0) setViewAll(null);
    if (viewAll === 'journeys' && trips.length === 0) setViewAll(null);
  }, [viewAll, inProgress.length, toBuy.length, trips.length]);

  const confirmDelete = (item: ToBuyRow) => {
    Alert.alert('Delete item', `Remove "${item.name}" from the list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteToBuy(item.id);
          load();
          showToast(`${item.name} deleted from To buy`, 'destroy');
        },
      },
    ]);
  };

  const resume = (trip: InProgressTrip) => {
    setViewAll(null);
    if (trip.open_stores === 0) {
      navigation.navigate('Review', { tripId: trip.id });
    } else {
      navigation.navigate('StorePicker', { tripId: trip.id });
    }
  };

  const addToTrip = (item: ToBuyRow) => {
    setViewAll(null);
    navigation.navigate('CartLoading', { toBuyId: item.id });
  };

  const openJourney = (trip: TripRow) => {
    setViewAll(null);
    navigation.navigate('Review', { tripId: trip.id });
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
            const discarded = discardTrip(trip.id);
            load();
            if (discarded) showToast('Trip discarded', 'destroy');
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
            showToast('Trip saved to journeys', 'success');
          },
        },
      ]
    );
  };

  const SectionHeader = ({ title, count }: { title: string; count: number }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{count}</Text>
      </View>
    </View>
  );

  // ---- Renderers shared by the page (first 3) and the sheet (all) ----

  const renderInProgressList = (list: InProgressTrip[]) =>
    list.map((trip) => {
      const allBought = trip.item_count > 0 && trip.bought_count === trip.item_count;
      return (
        <View key={trip.id} style={[styles.card, styles.tripCard]}>
          <View style={styles.rowBetween}>
            <Text style={styles.itemName}>{trip.name}</Text>
            <Text style={styles.itemMeta}>{trip.created_at.slice(0, 10)}</Text>
          </View>
          <ProgressBar value={trip.marked_count} total={trip.item_count} />
          <Text style={styles.itemMeta}>
            {trip.marked_count} of {trip.item_count} marked
          </Text>
          <View style={styles.actionRow}>
            <Pressable style={styles.resumeButton} onPress={() => resume(trip)}>
              <Text style={styles.resumeText}>Resume</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.onPrimary} />
            </Pressable>
            {!allBought && trip.bought_count > 0 && (
              <Pressable style={styles.textButton} onPress={() => confirmEndTrip(trip)}>
                <Text style={styles.textButtonLabel}>End trip</Text>
              </Pressable>
            )}
            {trip.bought_count === 0 && (
              <Pressable style={styles.textButton} onPress={() => confirmDiscard(trip)}>
                <Text style={[styles.textButtonLabel, { color: colors.danger }]}>Discard</Text>
              </Pressable>
            )}
          </View>
        </View>
      );
    });

  const renderToBuyRows = (list: ToBuyRow[]) =>
    list.map((item, index) => (
      <View key={item.id} style={[styles.row, index > 0 && styles.rowDivider]}>
        <View style={styles.rowText}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={styles.storeTag}>
            <Ionicons name="storefront-outline" size={13} color={colors.textMuted} />
            <Text style={styles.storeTagText}>{item.store_name ?? 'Any store'}</Text>
          </View>
        </View>
        <Pressable style={styles.addPill} onPress={() => addToTrip(item)}>
          <Ionicons name="add" size={16} color={colors.onPrimary} />
          <Text style={styles.addPillText}>Add to trip</Text>
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={() => confirmDelete(item)}
          accessibilityLabel="Delete"
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
      </View>
    ));

  const renderJourneyRows = (list: TripRow[]) =>
    list.map((trip, index) => (
      <Pressable
        key={trip.id}
        style={[styles.row, index > 0 && styles.rowDivider]}
        onPress={() => openJourney(trip)}
      >
        <View style={styles.rowText}>
          <Text style={styles.itemName}>{trip.name}</Text>
          <Text style={styles.itemMeta}>
            {trip.created_at.slice(0, 10)} · {trip.bought_count} of {trip.item_count} bought
          </Text>
          <View style={{ marginTop: 6 }}>
            <ProgressBar value={trip.bought_count} total={trip.item_count} color={colors.success} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>
    ));

  const sheetTitle = viewAll === 'progress' ? 'In progress' : viewAll === 'toBuy' ? 'To buy' : 'Saved journeys';
  const sheetCount = viewAll === 'progress' ? inProgress.length : viewAll === 'toBuy' ? toBuy.length : trips.length;
  
  const renderToast = (inHeader: boolean) => (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        inHeader && styles.toastInHeader,
        toast.kind === 'destroy' && styles.toastDestroy,
        {
          opacity: toastAnim,
          transform: [
            { translateX: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
          ],
        },
      ]}
    >
      <Ionicons
        name={toast.kind === 'destroy' ? 'trash' : 'checkmark-circle'}
        size={20}
        color={colors.textOnDark}
      />
      <Text style={styles.toastText} numberOfLines={1}>
        {toast.message}
      </Text>
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Hop between shops.{'\n'}Forget nothing.</Text>
          <Pressable style={styles.heroButton} onPress={() => navigation.navigate('CartLoading')}>
            <Ionicons name="add" size={22} color={colors.primary} />
            <Text style={styles.heroButtonText}>New trip</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {inProgress.length > 0 && (
            <>
              <SectionHeader title="In progress" count={inProgress.length} />
              {renderInProgressList(inProgress.slice(0, PREVIEW_COUNT))}
              {inProgress.length > PREVIEW_COUNT && (
                <Pressable
                  style={[styles.card, styles.viewAllRow]}
                  onPress={() => setViewAll('progress')}
                >
                  <Text style={styles.viewAllText}>View all ({inProgress.length})</Text>
                  <Ionicons name="chevron-up" size={18} color={colors.accent} />
                </Pressable>
              )}
            </>
          )}

          <SectionHeader title="To buy" count={toBuy.length} />
          {toBuy.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-circle-outline" size={30} color={colors.mutedOnDark} />
              <Text style={styles.empty}>
                Nothing waiting. Items marked No stock land here after a trip.
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              {renderToBuyRows(toBuy.slice(0, PREVIEW_COUNT))}
              {toBuy.length > PREVIEW_COUNT && (
                <Pressable
                  style={[styles.viewAllRow, styles.rowDivider]}
                  onPress={() => setViewAll('toBuy')}
                >
                  <Text style={styles.viewAllText}>View all ({toBuy.length})</Text>
                  <Ionicons name="chevron-up" size={18} color={colors.accent} />
                </Pressable>
              )}
            </View>
          )}

          <SectionHeader title="Saved journeys" count={trips.length} />
          {trips.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="map-outline" size={30} color={colors.mutedOnDark} />
              <Text style={styles.empty}>
                No journeys yet. Finish a trip and it will be saved here.
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              {renderJourneyRows(trips.slice(0, PREVIEW_COUNT))}
              {trips.length > PREVIEW_COUNT && (
                <Pressable
                  style={[styles.viewAllRow, styles.rowDivider]}
                  onPress={() => setViewAll('journeys')}
                >
                  <Text style={styles.viewAllText}>View all ({trips.length})</Text>
                  <Ionicons name="chevron-up" size={18} color={colors.accent} />
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {!viewAll && renderToast(false)}

      <Modal
        visible={viewAll !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setViewAll(null)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setViewAll(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{sheetTitle}</Text>
              <View style={styles.sheetCount}>
                <Text style={styles.sheetCountText}>{sheetCount}</Text>
              </View>
              <Pressable onPress={() => setViewAll(null)} hitSlop={8} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.onPrimary} />
              </Pressable>
            </View>
            <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetListContent}>
              {viewAll === 'progress' && renderInProgressList(inProgress)}
              {viewAll === 'toBuy' && <View style={styles.card}>{renderToBuyRows(toBuy)}</View>}
              {viewAll === 'journeys' && (
                <View style={styles.card}>{renderJourneyRows(trips)}</View>
              )}
            </ScrollView>

            <Pressable style={styles.sheetDone} onPress={() => setViewAll(null)}>
              <Text style={styles.sheetDoneText}>Done</Text>
            </Pressable>

            {renderToast(true)}
          </View>

        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 48 },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroTitle: { fontSize: 26, fontWeight: '800', lineHeight: 32, color: colors.onPrimary },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.onPrimary,
    paddingVertical: 14,
    borderRadius: radius.md,
    marginTop: 18,
  },
  heroButtonText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  body: { padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textOnDark },
  countBadge: { backgroundColor: colors.tint, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: 10,
  },
  tripCard: { padding: 14, gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  resumeText: { color: colors.onPrimary, fontWeight: '700' },
  textButton: { paddingVertical: 10, paddingHorizontal: 8 },
  textButtonLabel: { color: colors.accent, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.muted },
  rowText: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: colors.text },
  itemMeta: { color: colors.textMuted, marginTop: 2 },
  storeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  storeTagText: { color: colors.textMuted, fontSize: 13 },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  addPillText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  iconButton: { padding: 6 },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
  },
  viewAllText: { color: colors.accent, fontWeight: '700' },
  emptyBox: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    marginBottom: 10,
  },
  empty: { color: colors.mutedOnDark, textAlign: 'center' },

  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetTitle: { color: colors.onPrimary, fontSize: 17, fontWeight: '800' },
  sheetCount: {
    marginLeft: 'auto',
    backgroundColor: colors.onPrimary,
    borderRadius: 12,
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: 'center',
  },
  sheetCountText: { color: colors.primary, fontWeight: '800' },
  sheetList: { flexShrink: 1, backgroundColor: colors.field },
  sheetListContent: { padding: 12 },
  sheetDone: {
    backgroundColor: colors.primary,
    margin: 16,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  sheetDoneText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  root: { flex: 1 },
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
  toastDestroy: { backgroundColor: colors.danger },
  toastText: { color: colors.textOnDark, fontWeight: '700', flexShrink: 1 },
  toastInHeader: { top: 8 },
});