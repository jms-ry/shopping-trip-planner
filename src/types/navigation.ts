export type RootStackParamList = {
  Landing: undefined;
  CartLoading: undefined;
  Plan: { toBuyId?: number } | undefined;
  StorePicker: { tripId: number };
  StoreShopping: { tripId: number; storeId: number };
  Review: { tripId: number };
};