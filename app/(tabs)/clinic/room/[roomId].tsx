// app/(tabs)/clinic/room/[roomId].tsx

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  doc,
  limit as firestoreLimit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
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

type RoomActivityRecord = {
  id: string;
  recordId: string;
  collectionName: string;
  recordTypeLabel: string;

  applianceId: string;
  applianceName: string;
  applianceTypeKey: string;
  applianceTypeName: string;

  updatedAt: unknown;
  updatedAtMs: number;

  outcome: string | null;
  uploadStatus: string | null;

  /**
   * Autoclave-specific display helpers.
   */
  isAutoclaveRecord: boolean;
  isRunningDailyOps: boolean;
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

const ROOM_ACTIVITY_RECORD_COLLECTIONS = [
  'records',
  'records_DailyOps',
  'records_Helix',
  'records_Spore',
] as const;

const ROOM_ACTIVITY_DISPLAY_LIMIT = 10;

function getRecordTypeLabel(collectionName: string): string {
  switch (collectionName) {
    case 'records_DailyOps':
      return 'Daily Ops';
    case 'records_Helix':
      return 'Helix';
    case 'records_Spore':
      return 'Spore';
    case 'records':
      return 'Record';
    default:
      return collectionName;
  }
}

function getRecordIconName(
  collectionName: string,
): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  switch (collectionName) {
    case 'records_DailyOps':
      return 'autorenew';
    case 'records_Helix':
      return 'timer-sand';
    case 'records_Spore':
      return 'test-tube';
    case 'records':
      return 'clipboard-text-outline';
    default:
      return 'file-document-outline';
  }
}

function getTimestampMs(value: unknown): number {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (
    value &&
    typeof value === 'object' &&
    typeof (value as any).toMillis === 'function'
  ) {
    return (value as any).toMillis();
  }

  if (
    value &&
    typeof value === 'object' &&
    typeof (value as any).seconds === 'number'
  ) {
    return (value as any).seconds * 1000;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return 0;
}

function formatActivityUpdatedAt(value: unknown): string {
  const ms = getTimestampMs(value);

  if (!ms) {
    return 'Unknown time';
  }

  return new Intl.DateTimeFormat('en-HK', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getOutcomeStyleKey(
  outcome: string | null,
): 'pass' | 'fail' | 'pending' | 'neutral' {
  const normalized = outcome?.toLowerCase();

  if (normalized === 'pass' || normalized === 'passed') {
    return 'pass';
  }

  if (normalized === 'fail' || normalized === 'failed') {
    return 'fail';
  }

  if (normalized === 'pending') {
    return 'pending';
  }

  return 'neutral';
}

function isAutoclaveRecordCollection(collectionName: string): boolean {
  return (
    collectionName === 'records_DailyOps' ||
    collectionName === 'records_Helix' ||
    collectionName === 'records_Spore'
  );
}

function getAutoclaveActivityKind(collectionName: string): string {
  switch (collectionName) {
    case 'records_DailyOps':
      return 'Daily Ops';
    case 'records_Helix':
      return 'Helix';
    case 'records_Spore':
      return 'Spore';
    default:
      return 'Record';
  }
}

function getActivitySubtitle(activity: RoomActivityRecord): string {
  if (activity.isAutoclaveRecord) {
    return `Autoclave • ${getAutoclaveActivityKind(activity.collectionName)}`;
  }

  return activity.applianceTypeName || 'Appliance';
}

function getActivityVisibleStatus(activity: RoomActivityRecord): string | null {
  if (activity.isRunningDailyOps) {
    return 'Running';
  }

  return activity.outcome ?? activity.uploadStatus;
}

function getActivityStatusStyleKey(
  activity: RoomActivityRecord,
): 'pass' | 'fail' | 'running' | 'neutral' {
  if (activity.isRunningDailyOps) {
    return 'running';
  }

  const normalized = activity.outcome?.toLowerCase();

  if (normalized === 'pass' || normalized === 'passed') {
    return 'pass';
  }

  if (normalized === 'fail' || normalized === 'failed') {
    return 'fail';
  }

  return 'neutral';
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

  const [activities, setActivities] = useState<RoomActivityRecord[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  const applianceFlow = useAddApplianceFlow({
    clinicId,
    defaultRoom: roomId ? { id: roomId, roomName: room.roomName } : undefined,
  });

  const applianceIdsKey = useMemo(
    () => room.applianceList.map((appliance) => appliance.id).join('|'),
    [room.applianceList],
  );

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

  useEffect(() => {
    if (!clinicId || !roomId) {
      setActivities([]);
      setActivitiesLoading(false);
      setActivitiesError(null);
      return;
    }

    setActivitiesLoading(true);
    setActivitiesError(null);

    const activitiesQuery = query(
      collection(db, 'clinics', clinicId, 'rooms', roomId, 'activityRecords'),
      orderBy('updatedAt', 'desc'),
      firestoreLimit(10),
    );

    const unsubscribe = onSnapshot(
      activitiesQuery,
      (snapshot) => {
        const nextActivities: RoomActivityRecord[] = snapshot.docs.map((snap) => {
          const data = snap.data();

          const updatedAt = data.updatedAt;
          const updatedAtMs = getTimestampMs(updatedAt);

          return {
            id: snap.id,
            recordId: String(data.recordId ?? ''),
            collectionName: String(data.collectionName ?? ''),
            recordTypeLabel: String(data.recordTypeLabel ?? 'Record'),

            applianceId: String(data.applianceId ?? ''),
            applianceName: String(data.applianceName ?? 'Appliance'),
            applianceTypeKey: String(data.applianceTypeKey ?? ''),
            applianceTypeName: String(data.applianceTypeName ?? 'Appliance'),

            updatedAt,
            updatedAtMs,

            outcome: normalizeOptionalString(data.outcome),
            uploadStatus: normalizeOptionalString(data.uploadStatus),

            isAutoclaveRecord: Boolean(data.isAutoclaveRecord),
            isRunningDailyOps: Boolean(data.isRunningDailyOps),
          };
        });

        setActivities(nextActivities);
        setActivitiesLoading(false);
      },
      (error) => {
        console.error('Failed to load room activity index:', error);
        setActivitiesError('Unable to load recent activities.');
        setActivitiesLoading(false);
      },
    );

    return () => unsubscribe();
  }, [clinicId, roomId]);

  const openAddAppliance = useCallback(() => {
    if (!roomId) return;
    applianceFlow.open({ id: roomId, roomName: room.roomName });
  }, [applianceFlow, roomId, room.roomName]);

  const openApplianceScreen = useCallback(
    (applianceId: string, typeKey: string) => {
      if (!roomId) return;

      router.push({
        pathname: typeKey === 'autoclave' ? '/clinic/autoclave' : '/clinic/appliance-record',
        params: {
          roomId: String(roomId),
          applianceId: String(applianceId),
        },
      });
    },
    [router, roomId],
  );

  const openActivityRecord = useCallback(
    (activity: RoomActivityRecord) => {
      router.push({
        pathname: '/clinic/record-detail',
        params: {
          roomId: String(roomId),
          applianceId: String(activity.applianceId),
          collectionName: String(activity.collectionName),
          recordId: String(activity.recordId),
          recordTypeLabel: String(activity.recordTypeLabel),
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
          </View>

          {activitiesError ? (
            <View style={styles.activitiesBox}>
              <Text style={styles.errorText}>{activitiesError}</Text>
            </View>
          ) : activitiesLoading && activities.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Loading activities…</Text>
            </View>
          ) : activities.length === 0 ? (
            <View style={styles.activitiesBox}>
              <Text style={styles.emptyText}>No records yet.</Text>
            </View>
          ) : (
            <View style={styles.activitiesList}>
              {activities.map((activity) => {
                const applianceIcon = getApplianceIcon(activity.applianceTypeKey);
                const visibleStatus = getActivityVisibleStatus(activity);
                const statusStyleKey = getActivityStatusStyleKey(activity);
                const subtitle = getActivitySubtitle(activity);

                return (
                  <Pressable
                    key={activity.id}
                    onPress={() => openActivityRecord(activity)}
                    style={({ pressed }) => [
                      styles.activityChip,
                      statusStyleKey === 'pass' && styles.activityChipPass,
                      statusStyleKey === 'fail' && styles.activityChipFail,
                      statusStyleKey === 'running' && styles.activityChipRunning,
                      pressed && styles.activityChipPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${activity.applianceName}, ${subtitle}`}
                  >
                    <View
                      style={[
                        styles.activityIconWrap,
                        statusStyleKey === 'pass' && styles.activityIconWrapPass,
                        statusStyleKey === 'fail' && styles.activityIconWrapFail,
                        statusStyleKey === 'running' && styles.activityIconWrapRunning,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={applianceIcon.name}
                        size={22}
                        color={
                          statusStyleKey === 'pass'
                            ? '#15803d'
                            : statusStyleKey === 'fail'
                              ? '#b91c1c'
                              : statusStyleKey === 'running'
                                ? '#ea580c'
                                : applianceIcon.color ?? '#334155'
                        }
                      />
                    </View>

                    <View style={styles.activityMain}>
                      <View style={styles.activityTitleRow}>
                        <Text style={styles.activityTitle} numberOfLines={1}>
                          {activity.applianceName}
                        </Text>

                        {visibleStatus && (
                          <View
                            style={[
                              styles.statusBadge,
                              statusStyleKey === 'pass' && styles.statusBadgePass,
                              statusStyleKey === 'fail' && styles.statusBadgeFail,
                              statusStyleKey === 'running' && styles.statusBadgeRunning,
                            ]}
                          >
                            {statusStyleKey === 'running' && (
                              <MaterialCommunityIcons
                                name="progress-clock"
                                size={13}
                                color="#9a3412"
                              />
                            )}

                            <Text
                              style={[
                                styles.statusBadgeText,
                                statusStyleKey === 'pass' && styles.statusBadgeTextPass,
                                statusStyleKey === 'fail' && styles.statusBadgeTextFail,
                                statusStyleKey === 'running' &&
                                  styles.statusBadgeTextRunning,
                              ]}
                              numberOfLines={1}
                            >
                              {visibleStatus}
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.activitySubtitle} numberOfLines={1}>
                        {subtitle}
                      </Text>

                      <Text style={styles.activityTimeText} numberOfLines={1}>
                        Updated {formatActivityUpdatedAt(activity.updatedAt)}
                      </Text>
                    </View>

                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={24}
                      color={
                        statusStyleKey === 'pass'
                          ? '#15803d'
                          : statusStyleKey === 'fail'
                            ? '#b91c1c'
                            : statusStyleKey === 'running'
                              ? '#ea580c'
                              : '#94a3b8'
                      }
                    />
                  </Pressable>
                );
              })}
            </View>
          )}
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

  activitiesList: {
    marginTop: 10,
    gap: 10,
  },

  activityChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  activityChipPass: {
    borderColor: '#22c55e',
    borderWidth: 1.5,
    backgroundColor: '#f0fdf4',
  },

  activityChipFail: {
    borderColor: '#ef4444',
    borderWidth: 1.5,
    backgroundColor: '#fef2f2',
  },

  activityChipRunning: {
    borderColor: '#f97316',
    borderWidth: 1.5,
    backgroundColor: '#fff7ed',
  },

  activityChipPressed: {
    opacity: 0.78,
  },

  activityIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },

  activityIconWrapPass: {
    borderColor: '#86efac',
    backgroundColor: '#dcfce7',
  },

  activityIconWrapFail: {
    borderColor: '#fca5a5',
    backgroundColor: '#fee2e2',
  },

  activityIconWrapRunning: {
    borderColor: '#fdba74',
    backgroundColor: '#ffedd5',
  },

  activityMain: {
    flex: 1,
  },

  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  activityTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: '#1e293b',
  },

  activitySubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },

  activityTimeText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },

  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  statusBadgePass: {
    backgroundColor: '#dcfce7',
  },

  statusBadgeFail: {
    backgroundColor: '#fee2e2',
  },

  statusBadgeRunning: {
    backgroundColor: '#fed7aa',
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#475569',
    textTransform: 'capitalize',
  },

  statusBadgeTextPass: {
    color: '#15803d',
  },

  statusBadgeTextFail: {
    color: '#b91c1c',
  },

  statusBadgeTextRunning: {
    color: '#9a3412',
  },
});
