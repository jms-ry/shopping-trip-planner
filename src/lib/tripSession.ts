import { getTripSignature } from '../db/queries';

export type ToastRequest = { message: string; kind: 'success' | 'destroy' | 'info' };

type Session = { tripId: number; isNew: boolean; snapshot: string };

let session: Session | null = null;
let pendingToast: ToastRequest | null = null;

// Call when the user enters a trip: isNew for a just-created trip, false for Resume.
export function startTripSession(tripId: number, isNew: boolean) {
  session = { tripId, isNew, snapshot: getTripSignature(tripId) };
}

// Call when the user leaves the trip back to Landing.
export function queueLeaveToast(tripId: number, tripName: string) {
  if (!session || session.tripId !== tripId) return;

  if (session.isNew) {
    pendingToast = { message: `Trip "${tripName}" saved to In Progress`, kind: 'success' };
  } else if (getTripSignature(tripId) !== session.snapshot) {
    pendingToast = { message: `Changes made in Trip "${tripName}"`, kind: 'success' };
  } else {
    pendingToast = { message: `No changes made in Trip "${tripName}"`, kind: 'info' };
  }
  session = null;
}

// Landing calls this when it regains focus.
export function takePendingToast(): ToastRequest | null {
  const toast = pendingToast;
  pendingToast = null;
  return toast;
}

// Lets any screen leave a toast for Landing to show.
export function queueToast(toast: ToastRequest) {
  pendingToast = toast;
}

export function clearTripSession() {
  session = null;
}