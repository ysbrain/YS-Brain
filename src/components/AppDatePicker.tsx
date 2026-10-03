// src/components/AppDatePicker.tsx

import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { IosDateTimePickerOverlay } from './IosDateTimePickerOverlay';

type Props = {
  visible: boolean;
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
  onDone?: () => void;
};

export default function AppDatePicker({
  visible,
  value,
  onChange,
  onClose,
  onDone,
}: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) {
      setDraft(value);
    }
  }, [visible, value]);

  if (!visible) return null;

  if (Platform.OS === 'web') {
    return (
      <input
        autoFocus
        type="date"
        value={formatDate(value)}
        onChange={(e) => {
          const selected = e.target.value;

          if (!selected) return;

          const [y, m, d] =
            selected.split('-').map(Number);

          const next = new Date(
            y,
            m - 1,
            d,
            value.getHours(),
            value.getMinutes(),
          );

          onChange(next);
        }}
        onBlur={() => {
          onDone?.();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          opacity: 0,
          zIndex: 99999,
        }}
      />
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <IosDateTimePickerOverlay
        visible={visible}
        value={value}
        mode="date"
        onChange={(
          _event: DateTimePickerEvent,
          date?: Date,
        ) => {
          if (date) {
            onChange(date);
          }
        }}
        onClose={onClose}
        onDone={onDone ?? onClose}
      />
    );
  }

  return (
    <DateTimePicker
      value={value}
      mode="date"
      display="default"
      onChange={(
        event: DateTimePickerEvent,
        date?: Date,
      ) => {
        if (event.type === 'dismissed') {
          onClose();
          return;
        }

        if (date) {
          onChange(date);
        }

        onClose();
      }}
    />
  );
}

function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
