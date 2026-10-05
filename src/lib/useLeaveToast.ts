import { useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getTrip } from '../db/queries';
import { queueLeaveToast } from './tripSession';

// Queues a toast when the user goes Back from this screen straight to Landing.
export function useLeaveToast(tripId: number) {
  const navigation = useNavigation();
  const route = useRoute();

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      const type = e.data.action.type;
      if (type !== 'GO_BACK' && type !== 'POP') return; // ignore replace / reset

      const routes = navigation.getState().routes;
      const index = routes.findIndex((r) => r.key === route.key);
      if (routes[index - 1]?.name !== 'Landing') return;

      const trip = getTrip(tripId);
      if (trip && trip.status === 'shopping') queueLeaveToast(tripId, trip.name);
    });
  }, [navigation, route.key, tripId]);
}