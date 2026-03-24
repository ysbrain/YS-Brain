// app/(tabs)/clinic/index.tsx

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  collection,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useProfile } from '@/src/contexts/ProfileContext';
import { useAddApplianceFlow } from '@/src/hooks/useAddApplianceFlow';
import { db } from '@/src/lib/firebase';
import { getApplianceIcon } from '@/src/utils/applianceIcons';

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
  appliances: ApplianceItem[];
};

function toSafeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function roomFromDoc(docSnap: QueryDocumentSnapshot<DocumentData>): Room {
  const data = docSnap.data();  
  return {
    id: docSnap.id,
    roomIndex: Number(data.roomIndex ?? 0),
    roomName: toSafeString(data.roomName, 'Unnamed room'),
    description: toSafeString(data.description),
    appliances: [],
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
  const roomsPathReady = useMemo(() => Boolean(clinicId), [clinicId]);
  const roomIdsKey = useMemo(() => rooms.map((r) => r.id).join('|'), [rooms]);

  useEffect(() => {
    if (!roomsPathReady || !clinicId) {
      setRooms([]);
      setLoadingRooms(false);
      setError(null);
      return;
    }

    setLoadingRooms(true);
    setError(null);

    const roomsRef = collection(db, 'clinics', clinicId, 'rooms');
    const roomsQuery = query(roomsRef, orderBy('roomIndex', 'asc'));

    const unsubscribe = onSnapshot(
      roomsQuery,
      (snapshot) => {        
        setRooms((prev) => {
          const prevMap = new Map(prev.map((room) => [room.id, room]));
          return snapshot.docs.map((docSnap) => {
            const baseRoom = roomFromDoc(docSnap);
            const prevRoom = prevMap.get(baseRoom.id);
            return {
              ...baseRoom,
              appliances: prevRoom?.appliances ?? [],
            };
          });
        });
        setLoadingRooms(false);
      },
      (err) => {
        console.error('Rooms snapshot error:', err);
        setRooms([]);
        setError('Failed to load rooms.');
        setLoadingRooms(false);
      },
    );

    return unsubscribe;
  }, [roomsPathReady, clinicId]);

  
  useEffect(() => {
    if (!clinicId || !roomIdsKey) {
      return;
    }

    const roomIds = roomIdsKey.split('|').filter(Boolean);
    if (roomIds.length === 0) {
      return;
    }

    const unsubscribers = roomIds.map((roomId) => {
      const appliancesRef = collection(db, 'clinics', clinicId, 'rooms', roomId, 'appliances');
      const appliancesQuery = query(appliancesRef, orderBy('createdAt', 'asc'));

      return onSnapshot(
        appliancesQuery,
        (snapshot) => {
          const applianceList: ApplianceItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              key: toSafeString(data.applianceKey),
              name: toSafeString(data.applianceName, 'Unnamed appliance'),
              typeKey: toSafeString(data.typeKey),
              typeName: toSafeString(data.typeName),
            };
          });

          setRooms((prev) =>
            prev.map((room) =>
              room.id === roomId
                ? {
                    ...room,
                    appliances: applianceList,
                  }
                : room,
            ),
          );
        },
        (err) => {
          console.error(`Appliances snapshot error for room ${roomId}:`, err);
        },
      );
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [clinicId, roomIdsKey]);

  const goRoomDetail = useCallback(
    (room: Room) => {
      router.push({
        pathname: '/clinic/room/[roomId]',        
        params: {
          roomId: String(room.id),
          roomName: room.roomName,
          description: room.description,
        },
      });
    },
    [router],
  );

  const goRecord = useCallback(
    (roomId: string, applianceId: string) => {
      router.push({
        pathname: '/clinic/record',
        params: {
          roomId: String(roomId),
          applianceId: String(applianceId),
        },
      });
    },
    [router],
  );

  const openSelectModule = useCallback(
    (room: Room) => {
      applianceFlow.open({ id: room.id, roomName: room.roomName });
    },
    [applianceFlow],
  );

  const renderRoom: ListRenderItem<Room> = useCallback(
    ({ item }) => {
      const appliances = item.appliances ?? [];
      const applianceCount = appliances.length;
      const showMoreChip = applianceCount > 8;
      const visibleAppliances = showMoreChip ? appliances.slice(0, 7) : appliances;

      return (
        <Pressable
          onPress={() => goRoomDetail(item)}
          style={({ pressed }) => [styles.roomCardPressable, pressed && { opacity: 0.96 }]}
          accessibilityRole="button"
        >
          <View style={styles.roomCard}>
            <View style={styles.roomHeader}>
              <Text style={styles.roomTitle} numberOfLines={1}>
                {item.roomName}
              </Text>

              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  openSelectModule(item);
                }}
                style={({ pressed }) => [styles.newButton, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
              >
                <Text style={styles.newButtonText}>+ Appliance</Text>
              </Pressable>
            </View>

            {applianceCount === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No appliances yet.</Text>
              </View>
            ) : (
              <View style={styles.chipsWrap}>
                {visibleAppliances.map((a) => {
                  const icon = getApplianceIcon(a.typeKey);
                  return (
                    <Pressable
                      key={`${item.id}:${a.id}`}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        goRecord(item.id, a.id);
                      }}
                      style={({ pressed }) => [
                        styles.applianceChip,
                        pressed && styles.applianceChipPressed,
                      ]}
                      accessibilityRole="button"
                    >
                      <View style={styles.chipTopRow}>
                        <MaterialCommunityIcons
                          name={icon.name}
                          size={22}
                          color={icon.color ?? '#111'}
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
                  );
                })}

                {showMoreChip && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      goRoomDetail(item);
                    }}
                    style={({ pressed }) => [
                      styles.applianceChip,
                      styles.moreChip,
                      pressed && styles.applianceChipPressed,
                    ]}
                    accessibilityRole="button"
                  >
                    <View style={styles.chipTopRow}>
                      <MaterialCommunityIcons name="dots-horizontal" size={22} color="#111" />
                      <Text style={styles.moreChipText}>+{applianceCount - 7} more</Text>
                    </View>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </Pressable>
      );
    },
    [goRecord, goRoomDetail, openSelectModule],
  );

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
  roomCardPressable: {
    borderRadius: 22,
  },  
  roomCard: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#FFF',
  },  
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  roomTitle: {    
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
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
  applianceChipPressed: {
    opacity: 0.82,
  },
  applianceName: {
    flex: 1,
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
  moreChip: {
    backgroundColor: '#F3F3F3',
    borderStyle: 'dashed',
  },
  moreChipText: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },  
  newButton: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  newButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptyBox: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#FAFAFA',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontWeight: '600',
  },
});
