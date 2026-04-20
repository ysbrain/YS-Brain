import UiLockOverlayCard from '@/src/components/ui-lock/UiLockOverlayCard';
import { uiLockOverlayStyles } from '@/src/components/ui-lock/uiLockOverlayStyles';
import { useUiLock } from '@/src/contexts/UiLockContext';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

type BottomSheetShellProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  height?: ViewStyle['height'];
  maxHeight?: ViewStyle['maxHeight'];
  topSlot?: React.ReactNode;
  children: React.ReactNode;
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
  const { uiLocked, uiLockScope } = useUiLock();

  const modalLocked = uiLocked && uiLockScope === 'modal';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!modalLocked) onClose();
      }}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!modalLocked) onClose();
          }}
        />

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
              disabled={modalLocked}
              style={({ pressed }) => [
                styles.closeBtn,
                modalLocked && styles.closeBtnDisabled,
                pressed && !modalLocked && { opacity: 0.85 },
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

          {modalLocked && (
            <View style={uiLockOverlayStyles.overlayContainer} pointerEvents="auto">
              <UiLockOverlayCard />
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
});
