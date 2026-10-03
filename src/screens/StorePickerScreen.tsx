import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'StorePicker'>;

export default function StorePickerScreen({ route }: Props) {
  return (
    <View style={{ padding: 16 }}>
      <Text>StorePicker for trip {route.params.tripId}</Text>
    </View>
  );
}