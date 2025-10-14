import { auth } from '@/src/lib/auth';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={() => signOut(auth)}>
        <Ionicons name="log-out-outline" size={24} color="#fff" style={styles.icon} />
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e63946',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  icon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
