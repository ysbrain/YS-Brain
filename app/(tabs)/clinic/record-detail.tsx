// app/(tabs)/clinic/record-detail.tsx

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useProfile } from '@/src/contexts/ProfileContext';
import { db } from '@/src/lib/firebase';
import { normalizeParam } from '@/src/utils/routeParams';

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

  return 0;
}

function formatDateTime(value: unknown): string {
  const ms = getTimestampMs(value);

  if (!ms) {
    return '--';
  }

  return new Intl.DateTimeFormat('en-HK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '--';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Timestamp) {
    return formatDateTime(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function RecordDetailScreen() {
  const profile = useProfile();
  const clinicId = profile?.clinic;

  const params = useLocalSearchParams<{
    roomId?: string | string[];
    applianceId?: string | string[];
    collectionName?: string | string[];
    recordId?: string | string[];
    recordTypeLabel?: string | string[];
  }>();

  const roomId = normalizeParam(params.roomId);
  const applianceId = normalizeParam(params.applianceId);
  const collectionName = normalizeParam(params.collectionName);
  const recordId = normalizeParam(params.recordId);
  const recordTypeLabel = normalizeParam(params.recordTypeLabel) || 'Record';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recordData, setRecordData] = useState<Record<string, unknown> | null>(
    null,
  );

  const hasContext = Boolean(
    clinicId && roomId && applianceId && collectionName && recordId,
  );

  const displayFields = useMemo(() => {
    if (!recordData) {
      return [];
    }

    return Object.entries(recordData).filter(([key]) => {
      return !['createdAt', 'updatedAt'].includes(key);
    });
  }, [recordData]);

  useEffect(() => {
    if (!hasContext || !clinicId) {
      setLoading(false);
      setLoadError('Missing record context.');
      setRecordData(null);
      return;
    }

    setLoading(true);
    setLoadError(null);

    const recordRef = doc(
      db,
      'clinics',
      clinicId,
      'rooms',
      roomId,
      'appliances',
      applianceId,
      collectionName,
      recordId,
    );

    const unsubscribe = onSnapshot(
      recordRef,
      (snap) => {
        if (!snap.exists()) {
          setRecordData(null);
          setLoadError('Record not found.');
          setLoading(false);
          return;
        }

        setRecordData(snap.data() as Record<string, unknown>);
        setLoading(false);
      },
      (err) => {
        console.error('record detail snapshot error', err);
        setRecordData(null);
        setLoadError('Failed to load record.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [hasContext, clinicId, roomId, applianceId, collectionName, recordId]);

  return (
    <>
      <Stack.Screen options={{ title: recordTypeLabel }} />

      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerIconWrap}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={26}
              color="#111"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{recordTypeLabel}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {recordId}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator />
            <Text style={styles.helperText}>Loading record…</Text>
          </View>
        ) : loadError ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : recordData ? (
          <>
            <View style={styles.metaCard}>
              <Text style={styles.sectionTitle}>Timeline</Text>
              <Text style={styles.metaText}>
                Created: {formatDateTime(recordData.createdAt)}
              </Text>
              <Text style={styles.metaText}>
                Updated: {formatDateTime(recordData.updatedAt)}
              </Text>
            </View>

            <View style={styles.metaCard}>
              <Text style={styles.sectionTitle}>Record Data</Text>

              {displayFields.map(([key, value]) => (
                <View key={key} style={styles.fieldRow}>
                  <Text style={styles.fieldKey}>{key}</Text>
                  <Text style={styles.fieldValue}>{stringifyValue(value)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  centerBox: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    gap: 8,
  },
  helperText: {
    color: '#666',
    fontWeight: '700',
  },
  errorText: {
    color: '#B00020',
    fontWeight: '800',
    textAlign: 'center',
  },
  metaCard: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  fieldRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 10,
  },
  fieldKey: {
    fontSize: 12,
    fontWeight: '900',
    color: '#64748b',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
  },
});
