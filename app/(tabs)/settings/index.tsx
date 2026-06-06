// app/(tabs)/settings/index.tsx

import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { auth } from '@/src/lib/auth';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.moduleButton}
        onPress={() => router.push('/settings/create-module')}
        activeOpacity={0.85}
      >
        <Ionicons
          name="construct-outline"
          size={24}
          color="#111"
          style={styles.icon}
        />
        <Text style={styles.moduleButtonText}>Add Custom Appliance Module</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={() => signOut(auth)}
        activeOpacity={0.85}
      >
        <Ionicons
          name="log-out-outline"
          size={24}
          color="#fff"
          style={styles.icon}
        />
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 14,
    backgroundColor: '#f3f4f6',
  },
  moduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#111',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e63946',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  icon: {
    marginRight: 8,
  },
  moduleButtonText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '800',
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
