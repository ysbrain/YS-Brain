// src/components/autoclave/DailyOpsStartCard.tsx

import { ActionBlockerList } from '@/src/components/autoclave/ActionBlockerList';
import type {
  DailyOpsFieldFocusHandler,
  DailyOpsOpenPicker,
  DailyOpsRegisterFieldRef,
} from '@/src/components/autoclave/DailyOpsCardTypes';
import {
  AutoclaveReadonlyField,
  AutoclaveTextField,
  AutoclaveTimeField,
} from '@/src/components/autoclave/DailyOpsFields';
import { AUTOCLAVE_VALIDATION, DAILY_OPS_FIELD_KEYS } from '@/src/constants/autoclave';
import type { DailyOpsController } from '@/src/hooks/autoclave/useDailyOpsController';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

function sanitizeThreeDigitNumberInput(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, AUTOCLAVE_VALIDATION.maxThreeDigitLength);
}

type DailyOpsStartCardProps = {
  controller: DailyOpsController;
  registerFieldRef: DailyOpsRegisterFieldRef;
  onFieldFocus: DailyOpsFieldFocusHandler;
  onFieldBlur: DailyOpsFieldFocusHandler;
  openPicker: DailyOpsOpenPicker;
  saving: boolean;
};

export function DailyOpsStartCard({
  controller,
  registerFieldRef,
  onFieldFocus,
  onFieldBlur,
  openPicker,
  saving,
}: DailyOpsStartCardProps) {
  const {
    cycleIdPreview,
    formErrorField,
    setFormErrorField,
    maxTemp,
    setMaxTemp,
    pressure,
    setPressure,
    startTime,
    onStartMachine,
    canPressStartMachine,
    startBlockers,
  } = controller;

  return (
    <View style={styles.card}>
      <View style={styles.heroWrap}>
        <View style={styles.heroIconCircle}>
          <MaterialCommunityIcons name="play-outline" size={44} color="#4361ee" />
        </View>

        <Text style={styles.heroTitle}>Start New Cycle</Text>

        <Text style={styles.heroSubtitle}>
          Set parameters and begin sterilization.
        </Text>
      </View>

      <AutoclaveReadonlyField
        label="Next Cycle ID"
        value={cycleIdPreview}
      />

      <View style={styles.twoColRow}>
        <View style={styles.twoColItem}>
          <AutoclaveTextField
            ref={registerFieldRef(DAILY_OPS_FIELD_KEYS.maxTemp)}
            label="Max Temp (°C)"
            value={maxTemp}
            onChangeText={(text) => {
              setMaxTemp(sanitizeThreeDigitNumberInput(text));

              if (formErrorField === DAILY_OPS_FIELD_KEYS.maxTemp) {
                setFormErrorField(null);
              }
            }}
            placeholder="Enter temp"
            error={formErrorField === DAILY_OPS_FIELD_KEYS.maxTemp}
            keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
            maxLength={AUTOCLAVE_VALIDATION.maxThreeDigitLength}
            onFocus={() => onFieldFocus(DAILY_OPS_FIELD_KEYS.maxTemp)}
            onBlur={() => onFieldBlur(DAILY_OPS_FIELD_KEYS.maxTemp)}
          />
        </View>

        <View style={styles.twoColItem}>
          <AutoclaveTextField
            ref={registerFieldRef(DAILY_OPS_FIELD_KEYS.pressure)}
            label="Pressure (bar)"
            value={pressure}
            onChangeText={(text) => {
              setPressure(sanitizeThreeDigitNumberInput(text));

              if (formErrorField === DAILY_OPS_FIELD_KEYS.pressure) {
                setFormErrorField(null);
              }
            }}
            placeholder="Enter pressure"
            error={formErrorField === DAILY_OPS_FIELD_KEYS.pressure}
            keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
            maxLength={AUTOCLAVE_VALIDATION.maxThreeDigitLength}
            onFocus={() => onFieldFocus(DAILY_OPS_FIELD_KEYS.pressure)}
            onBlur={() => onFieldBlur(DAILY_OPS_FIELD_KEYS.pressure)}
          />
        </View>
      </View>

      <AutoclaveTimeField
        ref={registerFieldRef(DAILY_OPS_FIELD_KEYS.startTime)}
        label="Start Time"
        value={startTime}
        error={formErrorField === DAILY_OPS_FIELD_KEYS.startTime}
        onPress={() => {
          onFieldFocus(DAILY_OPS_FIELD_KEYS.startTime);

          if (formErrorField === DAILY_OPS_FIELD_KEYS.startTime) {
            setFormErrorField(null);
          }

          openPicker('startTime', 'time');
        }}
      />

      <ActionBlockerList blockers={startBlockers} />

      <Pressable
        onPress={onStartMachine}
        disabled={!canPressStartMachine}
        style={({ pressed }) => [
          styles.startButton,
          !canPressStartMachine && styles.startButtonDisabled,
          pressed && canPressStartMachine && { opacity: 0.92 },
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canPressStartMachine }}
      >
        <Text style={styles.startButtonText}>
          {saving ? 'Starting…' : 'Start Machine'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderColor: '#22c55e',
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 18,
  },
  heroWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  heroIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#e8eefc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  twoColItem: {
    flex: 1,
  },
  startButton: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#4361ee',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
});
