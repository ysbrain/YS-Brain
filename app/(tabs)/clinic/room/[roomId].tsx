// app/(tabs)/clinic/room/[roomId].tsx

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useProfile } from '@/src/contexts/ProfileContext';
import { useAddApplianceFlow } from '@/src/hooks/useAddApplianceFlow';
import { db } from '@/src/lib/firebase';
import { getApplianceIcon } from '@/src/utils/applianceIcons';

type ApplianceListItem = {
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

type RoomState = {
  roomName: string;
  description: string;
  applianceList: ApplianceListItem[];
};

function normalizeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function getAutoclaveStatus(
  data: Record<string, any>,
): ApplianceListItem['status'] {
  const rawStatus = data._status;

  if (!rawStatus || typeof rawStatus !== 'object') {
    return {
      isRunning: false,
      currentCycle: '',
    };
  }

  return {
    isRunning: Boolean(rawStatus.isRunning),
    currentCycle:
      typeof rawStatus.currentCycle === 'string'
        ? rawStatus.currentCycle
        : '',
  };
}

function getDefaultApplianceStatus(): ApplianceListItem['status'] {
  return {
    isRunning: false,
    currentCycle: '',
  };
}

function isRunningAutoclave(appliance: ApplianceListItem): boolean {
  return appliance.typeKey === 'autoclave' && appliance.status.isRunning;
}

export default function RoomDetailScreen() {
  const profile = useProfile();
  const clinicId = profile?.clinic;
  const router = useRouter();

  const params = useLocalSearchParams<{
    roomId?: string | string[];
    roomName?: string | string[];
    description?: string | string[];
  }>();

  const roomId = normalizeParam(params.roomId);
  const roomNameParam = normalizeParam(params.roomName);
  const descriptionParam = normalizeParam(params.description);

  const initialRoom: RoomState = useMemo(
    () => ({
      roomName: roomNameParam || 'Room',
      description: descriptionParam || '',
      applianceList: [],
    }),
    [roomNameParam, descriptionParam],
  );

  const [room, setRoom] = useState<RoomState>(initialRoom);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const applianceFlow = useAddApplianceFlow({
    clinicId,
    defaultRoom: roomId ? { id: roomId, roomName: room.roomName } : undefined,
  });

  useEffect(() => {
    if (!clinicId || !roomId) {
      setLoadError('Missing clinic or room information.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    const roomRef = doc(db, 'clinics', clinicId, 'rooms', roomId);
    const appliancesRef = collection(db, 'clinics', clinicId, 'rooms', roomId, 'appliances');
    const appliancesQuery = query(appliancesRef, orderBy('createdAt', 'asc'));
    
    const unsubRoom = onSnapshot(
      roomRef,
      (snap) => {
        if (!snap.exists()) {
          setRoom((prev) => ({
            ...prev,
            roomName: 'Room',
            description: '',
            applianceList: [],
          }));
          setLoadError('Room not found.');
          setLoading(false);
          return;
        }

        const data = snap.data();
        setRoom((prev) => ({
          ...prev,
          roomName:
            typeof data.roomName === 'string' && data.roomName.trim().length > 0
              ? data.roomName
              : 'Room',
          description:
            typeof data.description === 'string'
              ? data.description
              : '',
        }));
      },
      (err) => {
        console.error('room snapshot error', err);
        setLoadError('Failed to load room.');
        setLoading(false);
      },
    );

    const unsubAppliances = onSnapshot(
      appliancesQuery,
      (snapshot) => {
        const applianceList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const typeKey = typeof data.typeKey === 'string' ? data.typeKey : '';

          return {
            id: docSnap.id,
            key: typeof data.applianceKey === 'string' ? data.applianceKey : '',
            name:
              typeof data.applianceName === 'string'
                ? data.applianceName
                : 'Unnamed appliance',
            typeKey,
            typeName: typeof data.typeName === 'string' ? data.typeName : '',
            status:
              typeKey === 'autoclave'
                ? getAutoclaveStatus(data)
                : getDefaultApplianceStatus(),
          };
        });

        setRoom((prev) => ({
          ...prev,
          applianceList,
        }));
        setLoading(false);
      },
      (err) => {
        console.error('appliances snapshot error', err);
        setLoadError('Failed to load appliances.');
        setLoading(false);
      },
    );

    return () => {
      unsubRoom();
      unsubAppliances();
    };
  }, [clinicId, roomId]);

  const openAddAppliance = useCallback(() => {
    if (!roomId) return;
    applianceFlow.open({ id: roomId, roomName: room.roomName });
  }, [applianceFlow, roomId, room.roomName]);

  const openApplianceScreen = useCallback(
    (applianceId: string, typeKey: string) => {
      if (!roomId) return;

      router.push({
        pathname: typeKey === 'autoclave' ? '/clinic/autoclave' : '/clinic/record',
        params: {
          roomId: String(roomId),
          applianceId: String(applianceId),
        },
      });
    },
    [router, roomId],
  );

  return (
    <>
      <Stack.Screen options={{ title: room.roomName }} />

      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.description}>{room.description || ' '}</Text>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Appliances</Text>

            <Pressable
              onPress={openAddAppliance}
              style={({ pressed }) => [styles.newButton, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <Text style={styles.newButtonText}>+ Appliance</Text>
            </Pressable>
          </View>

          {loadError ? (
            <View style={styles.emptyBox}>
              <Text style={styles.errorText}>{loadError}</Text>
            </View>
          ) : loading && room.applianceList.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Loading appliances…</Text>
            </View>
          ) : room.applianceList.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No appliances yet.</Text>
            </View>
          ) : (
            <View style={styles.applianceList}>
              {room.applianceList.map((a) => {
                const icon = getApplianceIcon(a.typeKey);
                const runningAutoclave = isRunningAutoclave(a);

                return (
                  <Pressable
                    key={a.id}
                    onPress={() => openApplianceScreen(a.id, a.typeKey)}
                    style={({ pressed }) => [
                      styles.applianceRow,
                      runningAutoclave && styles.applianceRowRunning,
                      pressed && styles.applianceRowPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      runningAutoclave
                        ? `${a.name}, autoclave running daily ops cycle`
                        : `${a.name}, ${a.typeName || 'appliance'}`
                    }
                  >
                    <View style={styles.rowTop}>
                      <View
                        style={[
                          styles.rowIconWrap,
                          runningAutoclave && styles.rowIconWrapRunning,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={icon.name}
                          size={26}
                          color={runningAutoclave ? '#ea580c' : icon.color ?? '#111'}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={styles.nameLine}>
                          <Text
                            style={[
                              styles.applianceName,
                              runningAutoclave && styles.applianceNameRunning,
                            ]}
                            numberOfLines={1}
                          >
                            {a.name}
                          </Text>

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

                        {runningAutoclave && !!a.status.currentCycle && (
                          <Text style={styles.runningCycleText} numberOfLines={2}>
                            {`Cycle in progress:\n${a.status.currentCycle}`}
                          </Text>
                        )}
                      </View>

                      <MaterialCommunityIcons
                        name={runningAutoclave ? 'progress-clock' : 'chevron-right'}
                        size={26}
                        color={runningAutoclave ? '#ea580c' : '#777'}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Room Activities</Text>
          <View style={styles.activitiesBox}>
            <Text style={styles.emptyText}>No records yet.</Text>
          </View>
        </View>
      </ScrollView>

      {applianceFlow.Modals}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  description: {
    textAlign: 'center',
    color: '#222',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  loadingText: {
    color: '#666',
    fontWeight: '600',
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
  errorText: {
    textAlign: 'center',
    color: '#B00020',
    fontWeight: '700',
  },
  applianceList: {
    gap: 12,
    paddingBottom: 2,
  },
  applianceRow: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 14,
    minHeight: 72,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  applianceRowPressed: {
    opacity: 0.75,
  },
  applianceName: {
    fontSize: 16,
    fontWeight: '900',
  },
  applianceType: {
    marginTop: 6,
    fontSize: 13,
    color: '#444',
    fontWeight: '700',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  activitiesBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 14,
    backgroundColor: '#FAFAFA',
  },

  applianceRowRunning: {
    borderColor: '#f97316',
    borderWidth: 1.5,
    backgroundColor: '#fff7ed',
  },

  rowIconWrapRunning: {
    borderColor: '#fdba74',
    backgroundColor: '#ffedd5',
  },

  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  applianceNameRunning: {
    color: '#9a3412',
  },

  applianceTypeRunning: {
    color: '#c2410c',
  },

  runningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#fed7aa',
  },

  runningBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#9a3412',
  },

  runningCycleText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#c2410c',
  },
});
