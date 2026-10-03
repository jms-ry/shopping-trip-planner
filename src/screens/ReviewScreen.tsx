import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

export default function ReviewScreen({ route }: Props) {
  return (
    <View style={{ padding: 16 }}>
      <Text>Review for trip {route.params.tripId}</Text>
    </View>
  );
}