import { useProfile } from '@/src/contexts/ProfileContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { db } from '@/src/lib/firebase';
import { getServerTime } from '@/src/lib/serverTime';
import { isSameHKDay } from '@/src/lib/timezone';
import { doc, getDoc, Timestamp } from 'firebase/firestore';

type AutoclaveChild = 'helix' | 'spore';

function equipmentSplit(equipment: string): string {
  const equipSplit = equipment.split(' ');
  if (equipSplit.length === 2) return equipSplit[1];
  else return '';
}

export default function AutoclaveScreen() {
  const router = useRouter();
  const profile = useProfile();
  const equipment = useLocalSearchParams<{ equipment: string }>().equipment;
  const equipmentId = equipmentSplit(equipment);
  
  // ---- Cycle state
  const [cycleCount, setCycleCount] = useState<number | null>(null);
  const [loadingCycle, setLoadingCycle] = useState<boolean>(true);
  const [cycleError, setCycleError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCycle = async () => {
      try {
        const cycleDocRef = doc(db, 'clinics', profile.clinic, 'autoclave' + equipmentId, 'cycle');
        console.log('Fetching cycle doc from:', cycleDocRef.path);
        const snap = await getDoc(cycleDocRef);
        if (!snap.exists()) {
          setCycleError('Cycle doc not found');
          setCycleCount(null);
        } else {
          const data = snap.data() as { updatedAt?: Timestamp; cycleCount?: number };
          const ts = data?.updatedAt;
          const updatedAt = ts ? ts.toDate() : null;
          console.log('Cycle doc updatedAt:', updatedAt);

          // Get current server time
          const serverTime = await getServerTime();          
          console.log('Server time:', serverTime);

          //const data = snap.data() as { cycleCount?: number };
          if (typeof data.cycleCount === 'number') {
            if (updatedAt && isSameHKDay(updatedAt, serverTime)) {
              // newest doc is "today" (Hong Kong calendar day)
              setCycleCount(data.cycleCount);
            } else {
              // newest doc is NOT today
              setCycleCount(0);
            }           
          } else {
            setCycleError('cycleCount field missing or not a number');
            setCycleCount(null);
          }
        }
      } catch (err: any) {
        setCycleError(err?.message ?? 'Error loading cycle');
        setCycleCount(0);
      } finally {
        setLoadingCycle(false);
      }
    };

    fetchCycle();
  }, []);

  const handlePress = (item: AutoclaveChild): void => {
    console.log('Pressed:', item);
    if (cycleCount === null) {
      console.warn('Cannot proceed: cycle count not loaded');
      return;
    }

    const pathname: `/clinic/autoclave/${AutoclaveChild}` = `/clinic/autoclave/${item}`;
    router.push({
      pathname,
      params: {
        recordType: item,
        equipmentId,
        cycleString: String(cycleCount + 1)
      }
    });
  };

  return (
    <View style={styles.container}>      
      {/* 🔹 Cycle number line */}
      <View style={styles.cycleRow}>
        {loadingCycle ? (
          <View style={styles.cycleInline}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.cycleText}>  Loading cycle…</Text>
          </View>
        ) : cycleError ? (
          <Text style={[styles.cycleText, styles.cycleError]}>
            Cycle: — ({cycleError})
          </Text>
        ) : (
          <Text style={styles.cycleText}>Cycles ran today: {cycleCount}</Text>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => handlePress('helix')}
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
        onPress={() => handlePress('spore')}
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
    paddingTop: 12, // ensures the cycle line is visually separated from header
  },
  
  // 🔹 Cycle line styling
  cycleRow: {
    width: 300,
    marginBottom: 12, // sits above buttons
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cycleText: {
    fontSize: 18,
    color: '#1f2937',
    fontWeight: '600',
  },
  cycleError: {
    color: '#ef4444',
    fontWeight: '700',
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
