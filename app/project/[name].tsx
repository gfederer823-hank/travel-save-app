import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

export default function ProjectDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Text style={{ fontSize: 16, color: '#666666', marginBottom: 12 }}>
        旅遊專案
      </Text>

      <Text style={{ fontSize: 32, fontWeight: '700', textAlign: 'center' }}>
        {name}
      </Text>
    </View>
  );
}