// src/components/IosDateTimePickerOverlay.tsx

import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

export const IOS_PICKER_HEIGHT = 216;
export const IOS_PICKER_HEADER_HEIGHT = 44;
export const IOS_PICKER_OVERLAY_HEIGHT =
  IOS_PICKER_HEIGHT + IOS_PICKER_HEADER_HEIGHT + 12;

type IosDateTimePickerOverlayProps = {
  visible: boolean;
  value: Date;
  mode: 'date' | 'time';
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
  onClose: () => void;
  onDone: () => void;
  doneLabel?: string;
};

export function IosDateTimePickerOverlay({
  visible,
  value,
  mode,
  onChange,
  onClose,
  onDone,
  doneLabel = 'Done',
}: IosDateTimePickerOverlayProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const pickerTheme: 'light' | 'dark' = isDark ? 'dark' : 'light';
  const overlayBg = isDark ? '#333' : '#fff';
  const overlayBorder = '#111';
  const overlayText = isDark ? '#fff' : '#111';
  const overlayBackdrop = isDark
    ? 'rgba(0,0,0,0.45)'
    : 'rgba(0,0,0,0.15)';

  if (!visible || Platform.OS !== 'ios') {
    return null;
  }

  return (
    <View style={styles.overlayWrap} pointerEvents="auto">
      <Pressable
        style={[
          styles.overlayBackdrop,
          {
            backgroundColor: overlayBackdrop,
          },
        ]}
        onPress={onClose}
      />

      <View
        style={[
          styles.overlayPanel,
          {
            backgroundColor: overlayBg,
            borderTopColor: overlayBorder,
          },
        ]}
      >
        <View style={styles.overlayHeader}>
          <Pressable
            onPress={onDone}
            style={({ pressed }) => [
              styles.doneButton,
              {
                borderColor: overlayBorder,
                backgroundColor: overlayBg,
              },
              pressed && {
                opacity: 0.8,
              },
            ]}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.doneButtonText,
                {
                  color: overlayText,
                },
              ]}
            >
              {doneLabel}
            </Text>
          </Pressable>
        </View>

        <DateTimePicker
          value={value}
          mode={mode}
          display="spinner"
          onChange={onChange}
          themeVariant={pickerTheme}
          textColor={overlayText as any}
          style={[
            styles.iosPicker,
            {
              backgroundColor: overlayBg,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 999,
  },
  overlayBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  overlayPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingBottom: 12,
  },
  overlayHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  doneButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  doneButtonText: {
    fontWeight: '900',
  },
  iosPicker: {
    width: '100%',
    minWidth: 280,
    height: IOS_PICKER_HEIGHT,
  },
});
