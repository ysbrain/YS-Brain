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
  applianceList: ApplianceItem[];
};

function toSafeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function roomFromDoc(docSnap: QueryDocumentSnapshot<DocumentData>): Room {
  const data = docSnap.data();
  const applianceListRaw = Array.isArray(data.applianceList) ? data.applianceList : [];

  const applianceList: ApplianceItem[] = applianceListRaw
    .map((a: any) => ({
      id: toSafeString(a?.id),
      key: toSafeString(a?.key),
      name: toSafeString(a?.name, 'Unnamed appliance'),
      typeKey: toSafeString(a?.typeKey),
      typeName: toSafeString(a?.typeName),
    }))
    .filter((a) => a.id.length > 0);

  return {
    id: docSnap.id,
    roomIndex: Number(data.roomIndex ?? 0),
    roomName: toSafeString(data.roomName, 'Unnamed room'),
    description: toSafeString(data.description),
    applianceList,
  };
}

function AddApplianceChipContent() {
  return (
    <View style={styles.addChipRow}>
      <MaterialCommunityIcons name="plus-circle-outline" size={22} color="#111" />
      <Text style={styles.addChipText}>New Appliance</Text>
    </View>
  );
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
        setRooms(snapshot.docs.map(roomFromDoc));
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

  const goRoomDetail = useCallback(
    (room: Room) => {
      router.push({
        pathname: '/clinic/room/[roomId]',
        params: { roomId: String(room.id) },
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
      const appliances = item.applianceList ?? [];
      const applianceCount = appliances.length;

      const showMoreChip = applianceCount > 8;
      const visibleAppliances = showMoreChip ? appliances.slice(0, 7) : appliances;

      const showAddForOddUnder8 =
        applianceCount > 0 && applianceCount < 8 && applianceCount % 2 === 1;

      return (
        <Pressable
          onPress={() => goRoomDetail(item)}
          style={({ pressed }) => [styles.roomCardPressable, pressed && { opacity: 0.96 }]}
          accessibilityRole="button"
        >
          <View style={styles.roomCard}>
            <Text style={styles.roomTitle}>{item.roomName}</Text>

            {!!item.description && (
              <Text style={styles.roomDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            <View style={styles.chipsWrap}>
              {applianceCount > 0 ? (
                <>
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

                  {showAddForOddUnder8 && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        openSelectModule(item);
                      }}
                      style={({ pressed }) => [
                        styles.addChip,
                        pressed && styles.applianceChipPressed,
                      ]}
                      accessibilityRole="button"
                    >
                      <AddApplianceChipContent />
                    </Pressable>
                  )}
                </>
              ) : (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    openSelectModule(item);
                  }}
                  style={({ pressed }) => [styles.addChip, pressed && styles.applianceChipPressed]}
                  accessibilityRole="button"
                >
                  <AddApplianceChipContent />
                </Pressable>
              )}
            </View>
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
    padding: 16,
    backgroundColor: '#FFF',
  },
  roomTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  roomDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: '#555',
    marginBottom: 12,
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
