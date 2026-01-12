import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { db } from '@/src/lib/firebase';
import { getApplianceIcon } from '@/src/utils/applianceIcons';

export type ModuleItem = {
  id: string;           // document id (typeKey), e.g. waterLineTest
  moduleIndex: number;     // for sorting
  moduleName: string;
  description: string;
  official: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect?: (module: ModuleItem) => void; // display-only for now
};

export default function SelectApplianceTypeModal({
  visible,
  onClose,
  onSelect,
}: Props) {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;

    setLoading(true);

    // clinics/_common/modules sorted by moduleIndex asc
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

    return unsub;
  }, [visible]);
  
  const renderItem = ({ item }: { item: ModuleItem }) => {
    const icon = getApplianceIcon(item.id);

    return (
      <Pressable
        onPress={() => {
          onSelect?.(item); // display-only for now
          onClose();
        }}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      >
        {/* Tag pinned top-right of the bracket */}
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

          <View style={{ flex: 1, paddingRight: 88 /* room for tag */ }}>
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
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet */}
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Select Appliance Type</Text>

          <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}>
            <MaterialCommunityIcons name="close" size={22} color="#111" />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading modules…</Text>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
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
  sheetTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
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
  loadingText: {
    color: '#666',
    fontWeight: '700',
  },
  listContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 24,
  },
  
  row: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    position: 'relative', // important for absolute tag
  },

  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

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

  moduleName: {
    fontSize: 15,
    fontWeight: '900',
  },

  moduleDesc: {
    marginTop: 6,
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
  },

  // Tag pinned to top-right of the bracket
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

  tagOfficial: {
    backgroundColor: '#EAF7EA',
  },

  tagCustom: {
    backgroundColor: '#F3F3F3',
  },

  tagText: {
    fontSize: 12,
    fontWeight: '900',
  },
});
