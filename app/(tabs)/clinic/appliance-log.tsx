// app/(tabs)/clinic/appliance-log.tsx

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useProfile } from '@/src/contexts/ProfileContext';
import { db } from '@/src/lib/firebase';
import { getApplianceIcon } from '@/src/utils/applianceIcons';
import { normalizeParam } from '@/src/utils/routeParams';

type ApplianceLogRecord = {
  id: string;
  recordId: string;
  collectionName: string;
  recordTypeLabel: string;
  updatedAt: unknown;
  updatedAtMs: number;
  outcome: string | null;
  uploadStatus: string | null;
  isAutoclaveRecord: boolean;
  isRunningDailyOps: boolean;
};

const AUTOCLAVE_RECORD_COLLECTIONS = [
  'records_DailyOps',
  'records_Helix',
  'records_Spore',
] as const;

const NORMAL_RECORD_COLLECTIONS = ['records'] as const;

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

function formatUpdatedAt(value: unknown): string {
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

function getSubtitle(params: {
  typeKey: string;
  typeName: string;
  collectionName: string;
  isAutoclaveRecord: boolean;
}): string {
  const { typeName, collectionName, isAutoclaveRecord } = params;

  if (isAutoclaveRecord) {
    return `Autoclave • ${getAutoclaveActivityKind(collectionName)}`;
  }

  return typeName || 'Appliance';
}

function getVisibleStatus(record: ApplianceLogRecord): string | null {
  if (record.isRunningDailyOps) {
    return 'Running';
  }

  return record.outcome ?? record.uploadStatus;
}

function getStatusStyleKey(
  record: ApplianceLogRecord,
): 'pass' | 'fail' | 'running' | 'neutral' {
  if (record.isRunningDailyOps) {
    return 'running';
  }

  const normalized = record.outcome?.toLowerCase();

  if (normalized === 'pass' || normalized === 'passed') {
    return 'pass';
  }

  if (normalized === 'fail' || normalized === 'failed') {
    return 'fail';
  }

  return 'neutral';
}

export default function ApplianceLogScreen() {
  const profile = useProfile();
  const clinicId = profile?.clinic;
  const router = useRouter();

  const params = useLocalSearchParams<{
    roomId?: string | string[];
    applianceId?: string | string[];
    applianceName?: string | string[];
    typeKey?: string | string[];
    typeName?: string | string[];
  }>();

  const roomId = normalizeParam(params.roomId);
  const applianceId = normalizeParam(params.applianceId);
  const applianceName = normalizeParam(params.applianceName) || 'Appliance';
  const typeKey = normalizeParam(params.typeKey);
  const typeName = normalizeParam(params.typeName);

  const [records, setRecords] = useState<ApplianceLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const applianceIcon = useMemo(() => getApplianceIcon(typeKey), [typeKey]);

  const recordCollections = useMemo(() => {
    return typeKey === 'autoclave'
      ? AUTOCLAVE_RECORD_COLLECTIONS
      : NORMAL_RECORD_COLLECTIONS;
  }, [typeKey]);

  useEffect(() => {
    if (!clinicId || !roomId || !applianceId) {
      setRecords([]);
      setLoading(false);
      setLoadError('Missing clinic, room, or appliance information.');
      return;
    }

    setLoading(true);
    setLoadError(null);

    const recordsByCollection = new Map<string, ApplianceLogRecord[]>();

    const emitRecords = () => {
      const merged = Array.from(recordsByCollection.values())
        .flat()
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs);

      setRecords(merged);
      setLoading(false);
    };

    const unsubscribers = recordCollections.map((collectionName) => {
      const recordsRef = collection(
        db,
        'clinics',
        clinicId,
        'rooms',
        roomId,
        'appliances',
        applianceId,
        collectionName,
      );

      const recordsQuery = query(recordsRef, orderBy('updatedAt', 'desc'));

      return onSnapshot(
        recordsQuery,
        (snapshot) => {
          const nextRecords: ApplianceLogRecord[] = snapshot.docs.map(
            (recordSnap) => {
              const data = recordSnap.data();
              const updatedAt = data.updatedAt;
              const outcome = normalizeOptionalString(data._outcome);
              const uploadStatus = normalizeOptionalString(data._uploadStatus);
              const isAutoclaveRecord =
                isAutoclaveRecordCollection(collectionName);
              const isRunningDailyOps =
                collectionName === 'records_DailyOps' &&
                data._isFinished === false;

              return {
                id: `${collectionName}:${recordSnap.id}`,
                recordId: recordSnap.id,
                collectionName,
                recordTypeLabel: getRecordTypeLabel(collectionName),
                updatedAt,
                updatedAtMs: getTimestampMs(updatedAt),
                outcome,
                uploadStatus,
                isAutoclaveRecord,
                isRunningDailyOps,
              };
            },
          );

          recordsByCollection.set(collectionName, nextRecords);
          emitRecords();
        },
        (err) => {
          console.error(
            `appliance log snapshot error for ${collectionName}`,
            err,
          );
          recordsByCollection.set(collectionName, []);
          setLoadError('Failed to load some log records.');
          emitRecords();
        },
      );
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [clinicId, roomId, applianceId, recordCollections]);

  const openRecordDetail = (record: ApplianceLogRecord) => {
    router.push({
      pathname: '/clinic/record-detail',
      params: {
        roomId: String(roomId),
        applianceId: String(applianceId),
        collectionName: String(record.collectionName),
        recordId: String(record.recordId),
        recordTypeLabel: String(record.recordTypeLabel),
      },
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: `${applianceName} Log` }} />

      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerIconWrap}>
            <MaterialCommunityIcons
              name={applianceIcon.name}
              size={26}
              color={applianceIcon.color ?? '#111'}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {applianceName}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {typeKey === 'autoclave' ? 'Autoclave Records' : typeName || 'Records'}
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Log</Text>
          </View>

          {loadError ? (
            <View style={styles.emptyBox}>
              <Text style={styles.errorText}>{loadError}</Text>
            </View>
          ) : loading && records.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Loading log…</Text>
            </View>
          ) : records.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No records yet.</Text>
            </View>
          ) : (
            <View style={styles.recordList}>
              {records.map((record) => {
                const visibleStatus = getVisibleStatus(record);
                const statusStyleKey = getStatusStyleKey(record);
                const subtitle = getSubtitle({
                  typeKey,
                  typeName,
                  collectionName: record.collectionName,
                  isAutoclaveRecord: record.isAutoclaveRecord,
                });

                return (
                  <Pressable
                    key={record.id}
                    onPress={() => openRecordDetail(record)}
                    style={({ pressed }) => [
                      styles.recordChip,
                      statusStyleKey === 'pass' && styles.recordChipPass,
                      statusStyleKey === 'fail' && styles.recordChipFail,
                      statusStyleKey === 'running' && styles.recordChipRunning,
                      pressed && styles.recordChipPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${applianceName}, ${subtitle}`}
                  >
                    <View
                      style={[
                        styles.recordIconWrap,
                        statusStyleKey === 'pass' && styles.recordIconWrapPass,
                        statusStyleKey === 'fail' && styles.recordIconWrapFail,
                        statusStyleKey === 'running' &&
                          styles.recordIconWrapRunning,
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

                    <View style={styles.recordMain}>
                      <View style={styles.recordTitleRow}>
                        <Text style={styles.recordTitle} numberOfLines={1}>
                          {applianceName}
                        </Text>

                        {visibleStatus && (
                          <View
                            style={[
                              styles.statusBadge,
                              statusStyleKey === 'pass' &&
                                styles.statusBadgePass,
                              statusStyleKey === 'fail' &&
                                styles.statusBadgeFail,
                              statusStyleKey === 'running' &&
                                styles.statusBadgeRunning,
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
                                statusStyleKey === 'pass' &&
                                  styles.statusBadgeTextPass,
                                statusStyleKey === 'fail' &&
                                  styles.statusBadgeTextFail,
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

                      <Text style={styles.recordSubtitle} numberOfLines={1}>
                        {subtitle}
                      </Text>

                      <Text style={styles.recordTimeText} numberOfLines={1}>
                        Updated {formatUpdatedAt(record.updatedAt)}
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
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  headerCard: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
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
    fontWeight: '900',
    color: '#111',
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
  recordList: {
    gap: 10,
  },
  recordChip: {
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
  recordChipPass: {
    borderColor: '#22c55e',
    borderWidth: 1.5,
    backgroundColor: '#f0fdf4',
  },
  recordChipFail: {
    borderColor: '#ef4444',
    borderWidth: 1.5,
    backgroundColor: '#fef2f2',
  },
  recordChipRunning: {
    borderColor: '#f97316',
    borderWidth: 1.5,
    backgroundColor: '#fff7ed',
  },
  recordChipPressed: {
    opacity: 0.78,
  },
  recordIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordIconWrapPass: {
    borderColor: '#86efac',
    backgroundColor: '#dcfce7',
  },
  recordIconWrapFail: {
    borderColor: '#fca5a5',
    backgroundColor: '#fee2e2',
  },
  recordIconWrapRunning: {
    borderColor: '#fdba74',
    backgroundColor: '#ffedd5',
  },
  recordMain: {
    flex: 1,
  },
  recordTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: '#1e293b',
  },
  recordSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  recordTimeText: {
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
