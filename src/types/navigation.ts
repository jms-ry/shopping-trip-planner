export type RootStackParamList = {
  Landing: undefined;
  CartLoading: { toBuyId?: number } | undefined;
  Plan: { toBuyId?: number } | undefined;
  TripLoading: { tripId: number };
  StorePicker: { tripId: number };
  StoreShopping: { tripId: number; storeId: number };
  Review: { tripId: number };
};