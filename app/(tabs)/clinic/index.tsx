
import { useProfile } from '@/src/contexts/ProfileContext';
import { db } from '@/src/lib/firebase';
import {
  collection,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type ApplianceItem = {
  id: string;
  name: string;
  type: string;
};

type Room = {
  id: string; // Firestore doc id
  roomIndex: number;
  roomName: string;
  applianceList: ApplianceItem[];
};

function roomFromDoc(doc: QueryDocumentSnapshot<DocumentData>): Room {
  const data = doc.data();

  const applianceListRaw = Array.isArray(data.applianceList) ? data.applianceList : [];
  const applianceList: ApplianceItem[] = applianceListRaw.map((a: any) => ({
    id: String(a?.id ?? ''), // you said id is always present
    name: String(a?.name ?? 'Unnamed appliance'),
    type: String(a?.type ?? ''),
  }));

  return {
    id: doc.id,
    roomIndex: Number(data.roomIndex ?? 0),
    roomName: String(data.roomName ?? 'Unnamed room'),
    applianceList, // preserves stored order
  };
}

export default function ClinicScreen() {
  const profile = useProfile();
  const clinicId = profile?.clinic;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roomsPathReady = useMemo(() => Boolean(clinicId), [clinicId]);

  useEffect(() => {
    if (!roomsPathReady) {
      setRooms([]);
      setLoadingRooms(false);
      setError(null);
      return;
    }

    setLoadingRooms(true);
    setError(null);

    // Rooms query: order by roomIndex asc
    const roomsRef = collection(db, 'clinics', clinicId!, 'rooms');
    const roomsQuery = query(roomsRef, orderBy('roomIndex', 'asc'));

    const unsubscribe = onSnapshot(
      roomsQuery,
      (snapshot) => {
        setRooms(snapshot.docs.map(roomFromDoc));
        setLoadingRooms(false);
      },
      (err) => {
        console.error('Rooms snapshot error:', err);
        setError('Failed to load rooms.');
        setLoadingRooms(false);
      }
    );

    return unsubscribe;
  }, [roomsPathReady, clinicId]);

  const onAddAppliance = (room: Room) => {
    // TODO: Implement later
    console.log('Add appliance pressed for room:', room.id);
  };
  
  const renderRoom = ({ item }: { item: Room }) => {
    const appliances = item.applianceList ?? [];
    const applianceCount = appliances.length;

    // Rule: show up to 8 chips
    const showMoreChip = applianceCount > 8;
    const visibleAppliances = showMoreChip ? appliances.slice(0, 7) : appliances;

    // Rule:
    // If applianceCount is odd AND < 8 AND > 0 (i.e., 1,3,5,7),
    // append an additional "+ new appliance" chip.
    const showAddForOddUnder8 =
      applianceCount > 0 && applianceCount < 8 && applianceCount % 2 === 1;

    return (
      <View style={styles.roomCard}>
        <Text style={styles.roomTitle}>{item.roomName}</Text>

        <View style={styles.chipsWrap}>
          {applianceCount > 0 ? (
            <>
              {visibleAppliances.map((a) => (
                <View key={`${item.id}:${a.id}`} style={styles.applianceChip}>
                  <Text style={styles.applianceName} numberOfLines={1}>
                    {a.name}
                  </Text>
                  {!!a.type && (
                    <Text style={styles.applianceType} numberOfLines={1}>
                      {a.type}
                    </Text>
                  )}
                </View>
              ))}

              {showMoreChip && (
                // display-only for now (you can make Pressable later)
                <View style={[styles.applianceChip, styles.moreChip]}>
                  <Text style={styles.moreChipText} numberOfLines={1}>
                    +{applianceCount - 7} more
                  </Text>
                </View>
              )}

              {showAddForOddUnder8 && (
                <Pressable
                  onPress={() => onAddAppliance(item)}
                  style={({ pressed }) => [styles.addChip, pressed && { opacity: 0.75 }]}
                >
                  <Text style={styles.addChipText}>+ new appliance</Text>
                </Pressable>
              )}
            </>
          ) : (
            // applianceCount === 0: keep existing behavior
            <Pressable
              onPress={() => onAddAppliance(item)}
              style={({ pressed }) => [styles.addChip, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.addChipText}>+ new appliance</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {!roomsPathReady ? (
        <View style={styles.center}>
          <Text style={styles.hintText}>No clinic selected in profile.</Text>
        </View>
      ) : loadingRooms ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.hintText}>Loading rooms…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.id}
          renderItem={renderRoom}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.hintText}>No rooms found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 24,
    gap: 12,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  hintText: {
    marginTop: 8,
    color: '#666',
  },
  errorText: {
    color: '#B00020',
    fontWeight: '600',
  },

  roomCard: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#FFF',
  },
  roomTitle: {
    fontSize: 16,
    fontWeight: '700',    
    marginBottom: 12,
  },

  /**
   * ✅ Two-per-row centered grid:
   * - flexWrap to wrap
   * - justifyContent center to keep rows centered
   * - each chip width ~48% so 2 chips fit with gap
   */
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },

  /**
   * ✅ Bigger chip for better fit & readability
   * width: '48%' makes 2 chips per row (with gap)
   */
  applianceChip: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#FFF',
    minHeight: 64,
    justifyContent: 'center',
  },
  applianceName: {
    fontSize: 15,
    fontWeight: '800',
  },
  applianceType: {
    marginTop: 4,
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
  },

  // "+ more" chip styling
  moreChip: {
    backgroundColor: '#F3F3F3',
    borderStyle: 'dashed',
  },
  moreChipText: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },

  // Add appliance button (when empty)
  addChip: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: '#FFF',
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addChipText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
