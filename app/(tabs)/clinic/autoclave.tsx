import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function AutoclaveScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('./helix')}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>Perform Helix test</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => console.log('Spore test pressed')}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>Perform spore test</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => console.log('放入焗爐 pressed')}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>放入焗爐</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginVertical: 20,
    width: 300,
    flexDirection: 'row',
    alignItems: 'flex-start',
    // iOS shadow (optional)
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    // Android elevation (optional)
    elevation: 2,
  },
  // Applied only while pressing (via style callback)
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  icon: {
    color: '#fff',
    marginRight: 18,
  },
  buttonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
});
