// src/components/AppTimePicker.tsx

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

export default function AppTimePicker({
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
        type="time"
        value={formatTime(value)}
        onChange={(e) => {
          const selected = e.target.value;

          if (!selected) return;

          const [hh, mm] =
            selected.split(':').map(Number);

          const next = new Date(value);

          next.setHours(hh);
          next.setMinutes(mm);
          next.setSeconds(0);
          next.setMilliseconds(0);

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
        mode="time"
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
      mode="time"
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

function formatTime(date: Date) {
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ].join(':');
}
