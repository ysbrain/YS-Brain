import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { forwardRef } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type LabelProps = {
  label: string;
  required?: boolean;
  error?: boolean;
  variant?: 'default' | 'verify';
};

function FieldLabel({
  label,
  required = false,
  error = false,
  variant = 'default',
}: LabelProps) {
  return (
    <Text
      style={[
        variant === 'verify' ? styles.verifyFieldLabel : styles.fieldLabel,
        error && styles.errorLabel,
      ]}
    >
      {label}
      {required ? <Text style={styles.required}> *</Text> : null}
    </Text>
  );
}

type ReadonlyFieldProps = {
  label: string;
  value: string;
};

export function AutoclaveReadonlyField({
  label,
  value,
}: ReadonlyFieldProps) {
  return (
    <View style={styles.fieldBlock}>
      <FieldLabel label={label} />
      <View style={styles.readonlyField}>
        <Text style={styles.readonlyValue}>{value}</Text>
      </View>
    </View>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  error?: boolean;
  keyboardType?: 'default' | 'numeric' | 'number-pad';
  maxLength?: number;
  placeholderTextColor?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  returnKeyType?: 'done' | 'next';
};

export const AutoclaveTextField = forwardRef<TextInput, TextFieldProps>(
  (
    {
      label,
      value,
      onChangeText,
      placeholder,
      error = false,
      keyboardType = Platform.OS === 'ios' ? 'number-pad' : 'numeric',
      maxLength,
      placeholderTextColor = '#94a3b8',
      onFocus,
      onBlur,
      returnKeyType = 'done',
    },
    ref,
  ) => {
    return (
      <View style={styles.fieldBlock}>
        <FieldLabel label={label} error={error} />
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          style={[styles.textInput, error && styles.errorBorder]}
          returnKeyType={returnKeyType}
          maxLength={maxLength}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </View>
    );
  },
);

AutoclaveTextField.displayName = 'AutoclaveTextField';

type TimeFieldProps = {
  label: string;
  value: string;
  error?: boolean;
  onPress: () => void;
};

export const AutoclaveTimeField = forwardRef<any, TimeFieldProps>(
  ({ label, value, error = false, onPress }, ref) => {
    return (
      <View style={styles.fieldBlock}>
        <FieldLabel label={label} error={error} />
        <Pressable
          ref={ref}
          collapsable={false}
          onPress={onPress}
          style={({ pressed }) => [
            styles.timeField,
            error && styles.errorBorder,
            pressed && { opacity: 0.88 },
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.timeValue}>{value}</Text>
        </Pressable>
      </View>
    );
  },
);

AutoclaveTimeField.displayName = 'AutoclaveTimeField';

type PassFailFieldProps = {
  label: string;
  value: boolean | null;
  error?: boolean;
  onChange: (value: boolean) => void;
};

export const AutoclavePassFailField = forwardRef<any, PassFailFieldProps>(
  ({ label, value, error = false, onChange }, ref) => {
    return (
      <View style={styles.fieldBlock}>
        <FieldLabel label={label} required error={error} variant="verify" />

        <View ref={ref} collapsable={false}>
          <View style={styles.booleanRow}>
            <Pressable
              onPress={() => onChange(true)}
              style={({ pressed }) => [
                styles.booleanBtn,
                error && styles.errorBorder,
                value === true && styles.booleanBtnPassActive,
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={18}
                color={value === true ? '#15803d' : '#94a3b8'}
              />
              <Text
                style={[
                  styles.booleanBtnText,
                  value === true && styles.booleanBtnTextPassActive,
                ]}
              >
                Pass
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onChange(false)}
              style={({ pressed }) => [
                styles.booleanBtn,
                error && styles.errorBorder,
                value === false && styles.booleanBtnFailActive,
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="shield-alert-outline"
                size={18}
                color={value === false ? '#b91c1c' : '#94a3b8'}
              />
              <Text
                style={[
                  styles.booleanBtnText,
                  value === false && styles.booleanBtnTextFailActive,
                ]}
              >
                Fail
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  },
);

AutoclavePassFailField.displayName = 'AutoclavePassFailField';

type PhotoFieldProps = {
  label: string;
  photoUri: string | null;
  error?: boolean;
  onPress: () => void;
  aspectRatioFilled: number;
  aspectRatioEmpty: number;
  maxHeight?: number;
  placeholderText?: string;
};

export const AutoclavePhotoField = forwardRef<any, PhotoFieldProps>(
  (
    {
      label,
      photoUri,
      error = false,
      onPress,
      aspectRatioFilled,
      aspectRatioEmpty,
      maxHeight = 280,
      placeholderText = 'Tap to Capture Result',
    },
    ref,
  ) => {
    return (
      <View style={styles.fieldBlock}>
        <FieldLabel label={label} required error={error} variant="verify" />

        <Pressable
          ref={ref}
          collapsable={false}
          onPress={onPress}
          style={({ pressed }) => [
            styles.photoBox,
            error && styles.errorBorder,
            {
              aspectRatio: photoUri ? aspectRatioFilled : aspectRatioEmpty,
              maxHeight,
            },
            pressed && { opacity: 0.9 },
          ]}
          accessibilityRole="button"
        >
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.photoPreview}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <MaterialCommunityIcons
                name="camera-outline"
                size={30}
                color="#94a3b8"
              />
              <Text style={styles.photoPlaceholderText}>{placeholderText}</Text>
            </View>
          )}
        </Pressable>
      </View>
    );
  },
);

AutoclavePhotoField.displayName = 'AutoclavePhotoField';

type NotesFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
};

export const AutoclaveNotesField = forwardRef<TextInput, NotesFieldProps>(
  (
    {
      label,
      value,
      onChangeText,
      placeholder = 'Any issues observed?',
      onFocus,
      onBlur,
    },
    ref,
  ) => {
    return (
      <View style={styles.fieldBlock}>
        <FieldLabel label={label} variant="verify" />
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#999"
          style={styles.notesInput}
          returnKeyType="done"
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </View>
    );
  },
);

AutoclaveNotesField.displayName = 'AutoclaveNotesField';

const styles = StyleSheet.create({
  fieldBlock: {
    gap: 8,
    marginBottom: 16,
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },

  verifyFieldLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#64748b',
  },

  required: {
    color: '#B00020',
  },

  errorLabel: {
    color: '#B00020',
  },

  errorBorder: {
    borderColor: '#B00020',
    borderWidth: 2,
  },

  readonlyField: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  readonlyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },

  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    minHeight: 52,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
  },

  timeField: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  timeValue: {
    fontSize: 24,
    fontWeight: '500',
    color: '#475569',
    textAlign: 'center',
  },

  booleanRow: {
    flexDirection: 'row',
    gap: 10,
  },

  booleanBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 6,
    flexDirection: 'row',
  },

  booleanBtnPassActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },

  booleanBtnFailActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },

  booleanBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#94a3b8',
  },

  booleanBtnTextPassActive: {
    color: '#15803d',
  },

  booleanBtnTextFailActive: {
    color: '#b91c1c',
  },

  photoBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },

  photoPlaceholderText: {
    color: '#94a3b8',
    fontWeight: '700',
  },

  photoPreview: {
    width: '100%',
    height: '100%',
  },

  notesInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    minHeight: 46,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
});

export const dailyOpsFieldStyles = styles;
