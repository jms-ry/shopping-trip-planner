import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Keeps the end of a bottom sheet clear of the system navigation bar.
export default function SheetBottomInset() {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.bottom }} />;
}