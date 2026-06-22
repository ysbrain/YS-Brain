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
import { db } from '@/src/lib/firebase';
import { getApplianceIcon } from '@/src/utils/applianceIcons';

type ApplianceItem = {
  id: string;
  key: string;
  name: string;
  typeKey: string;
  typeName: string;
  status: {
    isRunning: boolean;
    currentCycle: string;
  };
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

function getAutoclaveStatus(data: DocumentData): ApplianceItem['status'] {
  const rawStatus = data._status;

  if (!rawStatus || typeof rawStatus !== 'object') {
    return {
      isRunning: false,
      currentCycle: '',
    };
  }

  return {
    isRunning: Boolean(rawStatus.isRunning),
    currentCycle: toSafeString(rawStatus.currentCycle),
  };
}

function getDefaultApplianceStatus(): ApplianceItem['status'] {
  return {
    isRunning: false,
    currentCycle: '',
  };
}

function isRunningAutoclave(appliance: ApplianceItem): boolean {
  return appliance.typeKey === 'autoclave' && appliance.status.isRunning;
}

export default function ClinicScreen() {
  const router = useRouter();
  const profile = useProfile();
  const clinicId = profile?.clinic;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            const typeKey = toSafeString(data.typeKey);

            return {
              id: docSnap.id,
              key: toSafeString(data.applianceKey),
              name: toSafeString(data.applianceName, 'Unnamed appliance'),
              typeKey,
              typeName: toSafeString(data.typeName),
              status:
                typeKey === 'autoclave'
                  ? getAutoclaveStatus(data)
                  : getDefaultApplianceStatus(),
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

  const openApplianceScreen = useCallback(
    (roomId: string, applianceId: string, typeKey: string) => {
      router.push({
        pathname: typeKey === 'autoclave' ? '/clinic/autoclave' : '/clinic/record',
        params: {
          roomId: String(roomId),
          applianceId: String(applianceId),
        },
      });
    },
    [router],
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
          style={({ pressed }) => [
            styles.roomCardPressable,
            pressed && styles.roomCardPressablePressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.roomName}`}
        >
          <View style={styles.roomCard}>
            <View style={styles.roomHeader}>
              <View style={styles.roomHeaderLeft}>
                <Text style={styles.roomTitle} numberOfLines={1}>
                  {item.roomName}
                </Text>

                {!!item.description && (
                  <Text style={styles.roomDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
              </View>

              <View style={styles.roomChevronCircle}>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={26}
                  color="#111827"
                />
              </View>
            </View>

            {applianceCount === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons
                  name="cube-outline"
                  size={20}
                  color="#64748b"
                />
                <Text style={styles.emptyText}>No appliances yet.</Text>
              </View>
            ) : (
              <View style={styles.chipsWrap}>
                {visibleAppliances.map((a) => {
                  const icon = getApplianceIcon(a.typeKey);
                  const runningAutoclave = isRunningAutoclave(a);

                  return (
                    <Pressable
                      key={`${item.id}:${a.id}`}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        openApplianceScreen(item.id, a.id, a.typeKey);
                      }}
                      style={({ pressed }) => [
                        styles.applianceChip,
                        runningAutoclave && styles.applianceChipRunning,
                        pressed && styles.applianceChipPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        runningAutoclave
                          ? `${a.name}, autoclave running daily ops cycle`
                          : `${a.name}, ${a.typeName || 'appliance'}`
                      }
                    >
                      <View style={styles.chipTopRow}>
                        <MaterialCommunityIcons
                          name={icon.name}
                          size={22}
                          color={runningAutoclave ? '#ea580c' : icon.color ?? '#111'}
                          style={styles.chipIcon}
                        />

                        <Text
                          style={[
                            styles.applianceName,
                            runningAutoclave && styles.applianceNameRunning,
                          ]}
                          numberOfLines={1}
                        >
                          {a.name}
                        </Text>
                      </View>

                      {!!a.typeName && (
                        <Text
                          style={[
                            styles.applianceType,
                            runningAutoclave && styles.applianceTypeRunning,
                          ]}
                          numberOfLines={1}
                        >
                          {a.typeName}
                        </Text>
                      )}

                      {runningAutoclave && (
                        <View style={styles.runningBadge}>
                          <MaterialCommunityIcons
                            name="clock-outline"
                            size={14}
                            color="#9a3412"
                          />
                          <Text style={styles.runningBadgeText}>Running</Text>
                        </View>
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
    [openApplianceScreen, goRoomDetail],
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
    paddingVertical: 10,
    paddingBottom: 28,
    gap: 16,
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
    borderRadius: 26,
  },

  roomCardPressablePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },

  roomCard: {
    borderWidth: 1.5,
    borderColor: '#dbeafe',
    borderRadius: 26,
    padding: 16,
    backgroundColor: '#ffffff',

    shadowColor: '#0f172a',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,

    elevation: 4,
  },

  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },

  roomHeaderLeft: {
    flex: 1,
  },

  roomTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0f172a',
  },

  roomDescription: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#64748b',
  },

  roomChevronCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 2,
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
  
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
  },

  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontWeight: '700',
  },

  applianceChipRunning: {
    borderColor: '#f97316',
    borderWidth: 1.5,
    backgroundColor: '#fff7ed',
  },

  applianceNameRunning: {
    color: '#9a3412',
  },

  applianceTypeRunning: {
    color: '#c2410c',
  },

  runningMiniIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffedd5',
  },

  runningBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fed7aa',
  },

  runningBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#9a3412',
  },
});
