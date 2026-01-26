import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

type BottomSheetShellProps = {
  visible: boolean;
  title: string;
  onClose: () => void;

  /**
   * Size control:
   * - Use height (e.g. '88%') when you want a fixed sheet height.
   * - Use maxHeight (e.g. '80%') when you want it to grow with content.
   */
  height?: ViewStyle['height'];
  maxHeight?: ViewStyle['maxHeight'];

  /** Optional content between header and body (e.g. "Add to Room" row) */
  topSlot?: React.ReactNode;

  /** Main content */
  children: React.ReactNode;

  /** Optional style overrides */
  sheetStyle?: ViewStyle;
  bodyStyle?: ViewStyle;
};

export default function BottomSheetShell({
  visible,
  title,
  onClose,
  height,
  maxHeight = '80%',
  topSlot,
  children,
  sheetStyle,
  bodyStyle,
}: BottomSheetShellProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false} />

      {/* Sheet */}
      <View
        style={[
          styles.sheet,
          height != null ? { height } : { maxHeight },
          sheetStyle,
        ]}
      >
        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <MaterialCommunityIcons name="close" size={22} color="#111" />
          </Pressable>
        </View>

        {/* Optional top slot */}
        {topSlot}

        {/* Body (flex container). Your modal decides what goes inside (ScrollView, FlatList, footer, etc.) */}
        <View style={[styles.body, bodyStyle]}>{children}</View>
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
  body: {
    flex: 1,
  },
});
