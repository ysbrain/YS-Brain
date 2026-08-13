// app/(tabs)/clinic/room-records.tsx

import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  collection,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
} from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useProfile } from '@/src/contexts/ProfileContext';
import { db } from '@/src/lib/firebase';

const PAGE_SIZE = 25;

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

  isAutoclaveRecord: boolean;
  isRunningDailyOps: boolean;
};

function normalizeParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getTimestampMs(value: unknown): number {
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

function formatActivityDate(value: unknown): string {
  const milliseconds = getTimestampMs(value);

  if (!milliseconds) {
    return 'Unknown time';
  }

  return new Intl.DateTimeFormat('en-HK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(milliseconds));
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

function getActivitySubtitle(
  activity: RoomActivityRecord,
): string {
  if (activity.isAutoclaveRecord) {
    return `Autoclave • ${activity.recordTypeLabel}`;
  }

  return activity.applianceTypeName || 'Appliance';
}

function getVisibleStatus(
  activity: RoomActivityRecord,
): string | null {
  if (activity.isRunningDailyOps) {
    return 'Running';
  }

  return activity.outcome ?? activity.uploadStatus;
}

function getStatusStyleKey(
  activity: RoomActivityRecord,
): 'pass' | 'fail' | 'running' | 'neutral' {
  if (activity.isRunningDailyOps) {
    return 'running';
  }

  const outcome = activity.outcome?.toLowerCase();

  if (outcome === 'pass' || outcome === 'passed') {
    return 'pass';
  }

  if (outcome === 'fail' || outcome === 'failed') {
    return 'fail';
  }

  return 'neutral';
}

function mapActivityDocument(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): RoomActivityRecord {
  const data = snapshot.data();
  const updatedAt = data.updatedAt;

  return {
    id: snapshot.id,

    recordId: String(data.recordId ?? ''),
    collectionName: String(data.collectionName ?? ''),
    recordTypeLabel: String(data.recordTypeLabel ?? 'Record'),

    applianceId: String(data.applianceId ?? ''),
    applianceName: String(data.applianceName ?? 'Appliance'),
    applianceTypeKey: String(data.applianceTypeKey ?? ''),
    applianceTypeName: String(
      data.applianceTypeName ?? 'Appliance',
    ),

    updatedAt,
    updatedAtMs: getTimestampMs(updatedAt),

    outcome: normalizeOptionalString(data.outcome),
    uploadStatus: normalizeOptionalString(data.uploadStatus),

    isAutoclaveRecord: Boolean(data.isAutoclaveRecord),
    isRunningDailyOps: Boolean(data.isRunningDailyOps),
  };
}

export default function RoomRecordsScreen() {
  const router = useRouter();
  const profile = useProfile();
  const clinicId = profile?.clinic;

  const params = useLocalSearchParams<{
    roomId?: string | string[];
    roomName?: string | string[];
  }>();

  const roomId = normalizeParam(params.roomId);
  const roomName = normalizeParam(params.roomName) || 'Room';

  const [records, setRecords] = useState<RoomActivityRecord[]>([]);
  const [lastDocument, setLastDocument] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const activityCollection = useMemo(() => {
    if (!clinicId || !roomId) {
      return null;
    }

    return collection(
      db,
      'clinics',
      clinicId,
      'rooms',
      roomId,
      'activityRecords',
    );
  }, [clinicId, roomId]);

  const loadFirstPage = useCallback(
    async (options?: { refreshing?: boolean }) => {
      if (!activityCollection) {
        setRecords([]);
        setLastDocument(null);
        setHasMore(false);
        setLoadError(
          'Missing clinic or room information.',
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (options?.refreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setLoadError(null);

      try {
        const firstPageQuery = query(
          activityCollection,
          orderBy('updatedAt', 'desc'),
          limit(PAGE_SIZE),
        );

        const snapshot = await getDocs(firstPageQuery);
        const nextRecords = snapshot.docs.map(
          mapActivityDocument,
        );

        setRecords(nextRecords);
        setLastDocument(
          snapshot.docs.at(-1) ?? null,
        );
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } catch (error) {
        console.error(
          'Failed to load room records:',
          error,
        );
        setLoadError('Unable to load room records.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activityCollection],
  );

  const loadMore = useCallback(async () => {
    if (
      !activityCollection ||
      !lastDocument ||
      !hasMore ||
      loading ||
      loadingMore ||
      refreshing
    ) {
      return;
    }

    setLoadingMore(true);
    setLoadError(null);

    try {
      const nextPageQuery = query(
        activityCollection,
        orderBy('updatedAt', 'desc'),
        startAfter(lastDocument),
        limit(PAGE_SIZE),
      );

      const snapshot = await getDocs(nextPageQuery);
      const nextRecords = snapshot.docs.map(
        mapActivityDocument,
      );

      setRecords((currentRecords) => {
        const existingIds = new Set(
          currentRecords.map((record) => record.id),
        );

        const uniqueNewRecords = nextRecords.filter(
          (record) => !existingIds.has(record.id),
        );

        return [...currentRecords, ...uniqueNewRecords];
      });

      setLastDocument(
        snapshot.docs.at(-1) ?? lastDocument,
      );
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error(
        'Failed to load more room records:',
        error,
      );
      setLoadError('Unable to load more records.');
    } finally {
      setLoadingMore(false);
    }
  }, [
    activityCollection,
    lastDocument,
    hasMore,
    loading,
    loadingMore,
    refreshing,
  ]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const openRecord = useCallback(
    (activity: RoomActivityRecord) => {
      if (
        !roomId ||
        !activity.applianceId ||
        !activity.collectionName ||
        !activity.recordId
      ) {
        return;
      }

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

  const renderRecord = useCallback(
    ({ item }: { item: RoomActivityRecord }) => {
      const status = getVisibleStatus(item);
      const statusStyleKey = getStatusStyleKey(item);

      return (
        <Pressable
          onPress={() => openRecord(item)}
          style={({ pressed }) => [
            styles.recordCard,

            statusStyleKey === 'pass' &&
              styles.recordCardPass,

            statusStyleKey === 'fail' &&
              styles.recordCardFail,

            statusStyleKey === 'running' &&
              styles.recordCardRunning,

            pressed && styles.recordCardPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.recordTypeLabel} record for ${item.applianceName}`}
        >
          <View
            style={[
              styles.iconWrap,

              statusStyleKey === 'pass' &&
                styles.iconWrapPass,

              statusStyleKey === 'fail' &&
                styles.iconWrapFail,

              statusStyleKey === 'running' &&
                styles.iconWrapRunning,
            ]}
          >
            <MaterialCommunityIcons
              name={getRecordIconName(item.collectionName)}
              size={23}
              color="#334155"
            />
          </View>

          <View style={styles.recordMain}>
            <View style={styles.recordTitleRow}>
              <Text
                style={styles.recordTitle}
                numberOfLines={1}
              >
                {item.applianceName || 'Appliance'}
              </Text>

              {status ? (
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
                  >
                    {status}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.recordSubtitle}>
              {getActivitySubtitle(item)}
            </Text>

            <Text style={styles.recordTime}>
              {formatActivityDate(item.updatedAt)}
            </Text>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color="#64748b"
          />
        </Pressable>
      );
    },
    [openRecord],
  );

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator />
          <Text style={styles.footerLoadingText}>
            Loading more records...
          </Text>
        </View>
      );
    }

    if (!hasMore && records.length > 0) {
      return (
        <Text style={styles.endText}>
          All room records have been loaded.
        </Text>
      );
    }

    return null;
  }, [hasMore, loadingMore, records.length]);

  return (
    <>
      <Stack.Screen
        options={{
          title: `${roomName} Records`,
        }}
      />

      <View style={styles.screen}>
        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>
              Loading room records...
            </Text>
          </View>
        ) : loadError && records.length === 0 ? (
          <View style={styles.centerContent}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={34}
              color="#b91c1c"
            />

            <Text style={styles.errorText}>
              {loadError}
            </Text>

            <Pressable
              onPress={() => void loadFirstPage()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.retryButtonText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={records}
            keyExtractor={(item) => item.id}
            renderItem={renderRecord}
            contentContainerStyle={[
              styles.listContent,
              records.length === 0 &&
                styles.emptyListContent,
            ]}
            ItemSeparatorComponent={() => (
              <View style={styles.separator} />
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() =>
                  void loadFirstPage({
                    refreshing: true,
                  })
                }
              />
            }
            onEndReached={() => void loadMore()}
            onEndReachedThreshold={0.35}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons
                  name="clipboard-text-clock-outline"
                  size={36}
                  color="#64748b"
                />

                <Text style={styles.emptyTitle}>
                  No room records
                </Text>

                <Text style={styles.emptyText}>
                  Records created for appliances in this room
                  will appear here.
                </Text>
              </View>
            }
            ListFooterComponent={listFooter}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
  },

  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  separator: {
    height: 10,
  },

  recordCard: {
    minHeight: 82,
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

  recordCardPass: {
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },

  recordCardFail: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },

  recordCardRunning: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },

  recordCardPressed: {
    opacity: 0.78,
  },

  iconWrap: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconWrapPass: {
    borderColor: '#86efac',
    backgroundColor: '#dcfce7',
  },

  iconWrapFail: {
    borderColor: '#fca5a5',
    backgroundColor: '#fee2e2',
  },

  iconWrapRunning: {
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
    color: '#1e293b',
    fontSize: 15,
    fontWeight: '900',
  },

  recordSubtitle: {
    marginTop: 4,
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },

  recordTime: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },

  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#e2e8f0',
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
    color: '#475569',
    fontSize: 11,
    fontWeight: '900',
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

  centerContent: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  loadingText: {
    color: '#64748b',
    fontWeight: '700',
  },

  errorText: {
    color: '#b91c1c',
    textAlign: 'center',
    fontWeight: '700',
  },

  retryButton: {
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 18,
    backgroundColor: '#111',
  },

  retryButtonText: {
    color: '#fff',
    fontWeight: '900',
  },

  buttonPressed: {
    opacity: 0.8,
  },

  emptyBox: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },

  emptyTitle: {
    marginTop: 4,
    color: '#1e293b',
    fontSize: 17,
    fontWeight: '900',
  },

  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '600',
  },

  footerLoading: {
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  footerLoadingText: {
    color: '#64748b',
    fontWeight: '700',
  },

  endText: {
    paddingVertical: 20,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '700',
  },
});
