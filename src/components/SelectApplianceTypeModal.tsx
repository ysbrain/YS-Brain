// src/components/SelectApplianceTypeModal.tsx

import { db } from '@/src/lib/firebase';
import { getApplianceIcon } from '@/src/utils/applianceIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
} from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type ModuleItem = {
  id: string;
  moduleIndex: number;
  moduleName: string;
  description: string;
  official: boolean;
};

type Props = {
  visible: boolean;
  roomName?: string;                // ✅ make optional for reusability
  onClose: () => void;
  onSelect?: (module: ModuleItem) => void;
  closeOnSelect?: boolean;          // ✅ default true
};

export default function SelectApplianceTypeModal({
  visible,
  roomName,
  onClose,
  onSelect,
  closeOnSelect = true,
}: Props) {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = collection(db, 'clinics', '_common', 'modules');
    const q = query(ref, orderBy('moduleIndex', 'asc'));

    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        const list: ModuleItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            moduleIndex: Number(data.moduleIndex ?? 0),
            moduleName: String(data.moduleName ?? ''),
            description: String(data.description ?? ''),
            official: Boolean(data.official ?? false),
          };
        });
        setModules(list);
        setLoading(false);
      },
      (err) => {
        console.error('Modules snapshot error:', err);
        setModules([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [visible]);

  const handlePick = useCallback(
    (item: ModuleItem) => {
      onSelect?.(item);
      if (closeOnSelect) onClose();
    },
    [onSelect, closeOnSelect, onClose]
  );

  const renderItem = useCallback(
    ({ item }: { item: ModuleItem }) => {
      const icon = getApplianceIcon(item.id);
      return (
        <Pressable
          onPress={() => handlePick(item)}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={`Select module ${item.moduleName}`}
        >
          <View
            style={[
              styles.tagPinned,
              item.official ? styles.tagOfficial : styles.tagCustom,
            ]}
          >
            <Text style={styles.tagText}>
              {item.official ? 'OFFICIAL' : 'CUSTOM'}
            </Text>
          </View>

          <View style={styles.rowTop}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name={icon.name}
                size={26}
                color={icon.color ?? '#111'}
              />
            </View>

            <View style={{ flex: 1, paddingRight: 88 }}>
              <Text style={styles.moduleName} numberOfLines={1}>
                {item.moduleName}
              </Text>

              {!!item.description && (
                <Text style={styles.moduleDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
            </View>
          </View>
        </Pressable>
      );
    },
    [handlePick]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Select Appliance Type</Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <MaterialCommunityIcons name="close" size={22} color="#111" />
          </Pressable>
        </View>

        {/* ✅ Only show this row if roomName is provided */}
        {!!roomName && (
          <View style={styles.addToRoomRow}>
            <Text style={styles.addToRoomLabel}>Add to Room:</Text>
            <MaterialCommunityIcons name="door" size={18} color="#111" />
            <Text style={styles.roomText} numberOfLines={1}>
              {roomName}
            </Text>
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.label}>Choose Module:</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading modules...</Text>
          </View>
        ) : (
          <FlatList
            data={modules}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: '#111',
    overflow: 'hidden',
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { fontSize: 16, fontWeight: '900' },
  closeBtn: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 12,
    padding: 8,
  },
  loadingBox: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: '#666', fontWeight: '700' },
  listContent: { padding: 14, gap: 12, paddingBottom: 24 },
  addToRoomRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  addToRoomLabel: { fontSize: 13, fontWeight: '900' },
  roomText: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  content: { padding: 16, paddingBottom: 10, gap: 12 },
  label: { fontSize: 13, fontWeight: '900' },
  row: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    position: 'relative',
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  moduleName: { fontSize: 15, fontWeight: '900' },
  moduleDesc: { marginTop: 6, fontSize: 13, color: '#444', fontWeight: '600' },
  tagPinned: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tagOfficial: { backgroundColor: '#EAF7EA' },
  tagCustom: { backgroundColor: '#F3F3F3' },
  tagText: { fontSize: 12, fontWeight: '900' },
});
