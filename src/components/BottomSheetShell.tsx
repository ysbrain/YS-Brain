import { useUiLock } from '@/src/contexts/UiLockContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

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
  const { uiLocked } = useUiLock();
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!uiLocked) onClose();
      }}
    >
      <View style={styles.modalRoot}>
        {/* Backdrop */}
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!uiLocked) onClose();
          }}
        />

        {/* Sheet */}
        <View
          style={[
            styles.sheet,
            height ? { height } : null,
            !height ? { maxHeight } : null,
            sheetStyle,
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>

            <Pressable
              onPress={onClose}
              disabled={uiLocked}
              style={({ pressed }) => [
                styles.closeBtn,
                uiLocked && styles.closeBtnDisabled,
                pressed && !uiLocked && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="close" size={20} color="#111" />
            </Pressable>
          </View>

          {topSlot}

          <View style={[styles.body, bodyStyle]}>
            {children}
          </View>

          {/* Local lock overlay INSIDE the modal layer */}
          {uiLocked && (
            <View style={styles.localBlockingOverlay} pointerEvents="auto">
              <View style={styles.localBlockingCard}>
                <ActivityIndicator size="large" color="#111" />
                <Text style={styles.localBlockingTitle}>Saving record…</Text>
                <Text style={styles.localBlockingText}>
                  Please wait. Uploading may take a few seconds.
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

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

  closeBtnDisabled: {
    opacity: 0.5,
  },

  body: {
    flex: 1,
  },

  localBlockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  localBlockingCard: {
    minWidth: 220,
    maxWidth: 300,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 18,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
  },

  localBlockingTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '900',
    color: '#111',
  },

  localBlockingText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
    textAlign: 'center',
    lineHeight: 18,
  },
});
