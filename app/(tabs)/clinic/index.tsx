import { db } from '@/src/lib/firebase';
import { Clinic, clinicConverter } from '@/src/types/clinic';
import { useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ListRenderItem, Pressable, StyleSheet, Text, View } from 'react-native';

function equipmentSplit(equipment: string): string {
  const equipSplit = equipment.split(' ');
  if (equipSplit.length === 2) return equipSplit[1];
  else return '';
}

export default function ClinicScreen() {
  const [equipment, setEquipment] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
    
  useEffect(() => {
    const ref = doc(db, 'clinics', 'clinic001').withConverter(clinicConverter);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const clinic = snap.data() as Clinic;
          setEquipment(clinic.equipment ?? []);
        } else {
          setEquipment([]);
          setError('Clinic not found.');
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);
  
  const handlePress = (item: string): void => {
    // TODO: navigate or perform an action per equipment item
    console.log('Pressed:', item);
    if (item.includes('Autoclave')) {
      console.log('Navigating to Autoclave screen');
      router.push({ pathname: '/clinic/autoclave', params: { equipmentId: equipmentSplit(item), title: item } });
    } else if (item.includes('Temperature')) {
      console.log('Navigating to Temperature screen');
      router.push({ pathname: '/clinic/temperature', params: { equipmentId: equipmentSplit(item) } });
    } else if (item.includes('Ultrasonic')) {
      console.log('Navigating to Ultrasonic screen');
      router.push('/clinic/ultrasonic');
    } else if (item.includes('AED')) {
      console.log('Navigating to AED screen');
      router.push('/clinic/aed');
    }
  };

  const renderItem: ListRenderItem<string> = ({ item }) => (
    <Pressable
      onPress={() => handlePress(item)}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      accessibilityRole="button"
    >
      <Text style={styles.buttonText}>{item}</Text>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>Loading clinic equipment…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Error: {error}</Text>
      </View>
    );
  }

  if (!equipment.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>No equipment found.</Text>
      </View>
    );
  }


  return (
    <View style={styles.container}>      
      <FlatList
        data={equipment}
        keyExtractor={(item, idx) => `${item}-${idx}`}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  buttonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  hint: { marginTop: 8, color: '#666' },
  error: { color: 'crimson' },
});
