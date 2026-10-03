import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'StoreShopping'>;

export default function StoreShoppingScreen({ route }: Props) {
  return (
    <View style={{ padding: 16 }}>
      <Text>
        StoreShopping: trip {route.params.tripId}, store {route.params.storeId}
      </Text>
    </View>
  );
}