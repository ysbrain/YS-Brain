import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        onPress={() => console.log('Notifications pressed')}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Ionicons name="notifications-outline" size={30} style={styles.icon} />
        <Text style={styles.buttonText}>Notifications</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => console.log('Warnings pressed')}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Ionicons name="warning-outline" size={30} style={styles.icon} />
        <Text style={styles.buttonText}>Warnings</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => console.log('Useful links pressed')}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Ionicons name="link-outline" size={30} style={styles.icon} />
        <Text style={styles.buttonText}>Useful links</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => console.log("Dr. Wah's games pressed")}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Ionicons name="game-controller-outline" size={30} style={styles.icon} />
        <Text style={styles.buttonText}>Dr. Wah&apos;s games</Text>
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
