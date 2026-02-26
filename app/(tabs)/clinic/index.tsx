import { useProfile } from '@/src/contexts/ProfileContext';
import { db } from '@/src/lib/firebase';
import { useRouter } from 'expo-router';
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

import { getApplianceIcon } from '@/src/utils/applianceIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAddApplianceFlow } from '@/src/hooks/useAddApplianceFlow';

type ApplianceItem = {
  id: string;
  key: string;
  name: string;
  typeKey: string;
  typeName: string;
};

type Room = {
  id: string;
  roomIndex: number;
  roomName: string;
  description: string;
  applianceList: ApplianceItem[];
};

function roomFromDoc(doc: QueryDocumentSnapshot<DocumentData>): Room {
  const data = doc.data();
  const applianceListRaw = Array.isArray(data.applianceList) ? data.applianceList : [];

  const applianceList: ApplianceItem[] = applianceListRaw.map((a: any) => ({
    id: String(a.id),
    key: String(a?.key ?? ''),
    name: String(a?.name ?? 'Unnamed appliance'),
    typeKey: String(a?.typeKey ?? ''),
    typeName: String(a?.typeName ?? ''),
  }));

  return {
    id: doc.id,
    roomIndex: Number(data.roomIndex ?? 0),
    roomName: String(data.roomName ?? 'Unnamed room'),
    description: String(data.description ?? ''),
    applianceList,
  };
}

export default function ClinicScreen() {
  const router = useRouter();
  const profile = useProfile();
  const clinicId = profile?.clinic;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applianceFlow = useAddApplianceFlow({ clinicId });
  const openSelectModule = (room: Room) => {    
    applianceFlow.open({ id: room.id, roomName: room.roomName });
  };

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
  
  const goRoomDetail = (room: Room) => {
    router.push({
      pathname: "/clinic/room/[roomId]",
      params: { roomId: String(room.id) }
    });
  };
  
  const NewApplianceChipContent = () => (
    <View style={styles.addChipRow}>
      <MaterialCommunityIcons name="plus-circle-outline" size={22} color="#111" />
      <Text style={styles.addChipText}>New Appliance</Text>
    </View>
  );
  
  const renderRoom = ({ item }: { item: Room }) => {
    const appliances = item.applianceList ?? [];
    const applianceCount = appliances.length;

    // Rule: show up to 8 chips
    const showMoreChip = applianceCount > 8;
    const visibleAppliances = showMoreChip ? appliances.slice(0, 7) : appliances;

    // Rule:
    // If applianceCount is odd AND < 8 AND > 0 (i.e., 1,3,5,7),
    // append an additional "+ appliance" chip.
    const showAddForOddUnder8 =
      applianceCount > 0 && applianceCount < 8 && applianceCount % 2 === 1;
    
    return (
      <Pressable
        onPress={() => goRoomDetail(item)}
        style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1 }]}
      >
        <View style={styles.roomCard}>
          <Text style={styles.roomTitle}>{item.roomName}</Text>

          <View style={styles.chipsWrap}>
            {applianceCount > 0 ? (
              <>
                {visibleAppliances.map((a) => (                  
                  <Pressable
                    key={`${item.id}:${a.id}`}
                    onPress={(e) => {                      
                      e.stopPropagation?.(); // keep “chip press doesn’t open room”
                      router.push({
                        pathname: "/clinic/record",
                        params: {
                          roomId: String(item.id),
                          applianceId: String(a.id),
                        },
                      });
                    }}
                    style={styles.applianceChip}
                  >
                    <View style={styles.chipTopRow}>
                      <MaterialCommunityIcons
                        name={getApplianceIcon(a.typeKey).name}
                        size={22}
                        color={getApplianceIcon(a.typeKey).color ?? '#111'}
                        style={styles.chipIcon}
                      />
                      <Text style={styles.applianceName} numberOfLines={1}>
                        {a.name}
                      </Text>
                    </View>

                    {!!a.typeName && (
                      <Text style={styles.applianceType} numberOfLines={1}>
                        {a.typeName}
                      </Text>
                    )}
                  </Pressable>
                ))}
                
                {showMoreChip && (
                  <Pressable
                    onPress={(e) => {
                      // Prevent double-trigger if parent also receives press (safe)
                      e.stopPropagation?.();
                      goRoomDetail(item); // same as pressing the room card
                    }}
                    style={[styles.applianceChip, styles.moreChip]}
                  >
                    <View style={styles.chipTopRow}>
                      <MaterialCommunityIcons name="dots-horizontal" size={22} color="#111" />
                      <Text style={styles.moreChipText}>+{applianceCount - 7} more</Text>
                    </View>
                  </Pressable>
                )}

                {showAddForOddUnder8 && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      openSelectModule(item);
                    }}
                    style={styles.addChip}
                  >
                    <NewApplianceChipContent />
                  </Pressable>
                )}
              </>
            ) : (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  openSelectModule(item);
                }}
                style={styles.addChip}
              >
                <NewApplianceChipContent />
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
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
      
      {applianceFlow.Modals}
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
  
  chipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chipIcon: {
    marginTop: 1,
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
  addChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
});
