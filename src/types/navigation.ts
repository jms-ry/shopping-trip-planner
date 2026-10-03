export type RootStackParamList = {
  Landing: undefined;
  Plan: { toBuyId?: number } | undefined;
  StorePicker: { tripId: number };
  StoreShopping: { tripId: number; storeId: number };
};