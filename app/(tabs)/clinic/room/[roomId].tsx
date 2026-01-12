
import { Stack, useLocalSearchParams } from 'expo-router';
import { collection, DocumentData, onSnapshot, QuerySnapshot } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useProfile } from '@/src/contexts/ProfileContext';
import { db } from '@/src/lib/firebase';

import SelectApplianceTypeModal, { ModuleItem } from '@/src/components/SelectApplianceTypeModal';
import { getApplianceIcon } from '@/src/utils/applianceIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type ApplianceListItem = {
  id: string;
  name: string;
  typeKey: string;
  typeLabel: string;
};

type ApplianceDoc = {
  id: string;
  applianceName?: string;
  applianceType?: string;
  // add more fields later if you need
};

export default function RoomDetailScreen() {
  const profile = useProfile();
  const clinicId = profile?.clinic;

  const params = useLocalSearchParams<{
    roomId: string;
    roomName?: string;
    description?: string;
    applianceList?: string; // JSON string
  }>();

  const roomId = params.roomId;
  const roomName = params.roomName ?? 'Room';
  const description = params.description ?? '';

  // Parse applianceList passed from clinic.tsx (preserves order)
  const baseApplianceList: ApplianceListItem[] = useMemo(() => {
    try {
      const raw = params.applianceList ? JSON.parse(params.applianceList) : [];
      if (!Array.isArray(raw)) return [];
      return raw.map((x: any) => ({
        id: String(x.id),
        name: String(x?.name ?? ''),
        typeKey: String(x?.typeKey ?? ''),
        typeLabel: String(x?.typeLabel ?? ''),
      }));
    } catch {
      return [];
    }
  }, [params.applianceList]);

  const [loading, setLoading] = useState(true);
  const [applianceMap, setApplianceMap] = useState<Record<string, ApplianceDoc>>({});
  
  // Modal state (add here)
  const [typeModalVisible, setTypeModalVisible] = useState(false);

  const onSelectModule = (module: ModuleItem) => {
    // display-only for now
    console.log('Selected module:', module.id, module.moduleName, 'for room:', roomId);
  };

  useEffect(() => {
    if (!clinicId || !roomId) return;

    setLoading(true);

    const appliancesRef = collection(db, 'clinics', clinicId, 'rooms', roomId, 'appliances');
    const unsub = onSnapshot(
      appliancesRef,
      (snap: QuerySnapshot<DocumentData>) => {
        const nextMap: Record<string, ApplianceDoc> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          nextMap[d.id] = {
            id: d.id,
            applianceName: data.applianceName,
            applianceType: data.applianceType,
          };
        });
        setApplianceMap(nextMap);
        setLoading(false);
      },
      (err) => {
        console.error('Appliances snapshot error:', err);
        setLoading(false);
      }
    );

    return unsub;
  }, [clinicId, roomId]);

  // Merge base list (order + quick display) with Firestore docs (latest values)
  const orderedAppliances = useMemo(() => {
    return baseApplianceList.map((base) => {
      const doc = applianceMap[base.id];
      return {
        id: base.id,
        name: doc?.applianceName ?? base.name,
        typeKey: doc?.applianceType ?? base.typeKey,
        typeLabel: doc?.applianceType ?? base.typeLabel,
      };
    });
  }, [baseApplianceList, applianceMap]);

  return (
    <>
      {/* 1) Header title = room name */}
      <Stack.Screen options={{ title: roomName }} />

      {/* Pattern C: no SafeAreaView here; header/tab will manage safe areas */}
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {/* 2) Room description from clinic.tsx room doc field "description" */}
        <Text style={styles.description}>{description || ' '}</Text>

        {/* Appliances & Modules section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Appliances & Modules</Text>

            <Pressable
              onPress={() => setTypeModalVisible(true)}
              style={({ pressed }) => [styles.newButton, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.newButtonText}>+ Appliance</Text>
            </Pressable>
          </View>

          {loading && orderedAppliances.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Loading appliances…</Text>
            </View>
          ) : orderedAppliances.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No appliances yet.</Text>
            </View>
          ) : (
            <View style={styles.applianceList}>
              {/** 5) List in the same order as applianceList array */}
              {orderedAppliances.map((a) => (                
                <Pressable
                  key={a.id}
                  onPress={() => {
                    // display-only for now; later open config modal/sheet
                    console.log('Appliance pressed:', a.id);
                  }}
                  style={({ pressed }) => [
                    styles.applianceRow,
                    pressed && styles.applianceRowPressed,
                  ]}
                  accessibilityRole="button"
                >
                  <View style={styles.rowTop}>
                    <View style={styles.rowIconWrap}>
                      <MaterialCommunityIcons
                        name={getApplianceIcon(a.typeKey).name}
                        size={26}
                        color={getApplianceIcon(a.typeKey).color ?? '#111'}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.applianceName} numberOfLines={1}>
                        {a.name}
                      </Text>
                      {!!a.typeLabel && (
                        <Text style={styles.applianceType} numberOfLines={1}>
                          {a.typeLabel}
                        </Text>
                      )}
                    </View>

                    {/* Optional chevron to indicate "config" later */}
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={26}
                      color="#777"
                    />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* 6) Room Activities placeholder */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Room Activities</Text>
          <View style={styles.activitiesBox}>
            <Text style={styles.emptyText}>No records yet.</Text>
          </View>
        </View>
      </ScrollView>
      
      {/* Modal */}
      <SelectApplianceTypeModal
        visible={typeModalVisible}
        onClose={() => setTypeModalVisible(false)}
        onSelect={onSelectModule}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
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

  applianceList: {
    gap: 12,
    paddingBottom: 2,
  },

  // Large rows like your sketch (big rounded rectangles)
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
});
