// src/components/autoclave/DailyOpsRunningCard.tsx

import { ActionBlockerList } from '@/src/components/autoclave/ActionBlockerList';
import type {
  DailyOpsFieldFocusHandler,
  DailyOpsOpenPicker,
  DailyOpsRegisterFieldRef,
} from '@/src/components/autoclave/DailyOpsCardTypes';
import {
  AutoclaveNotesField,
  AutoclavePassFailField,
  AutoclavePhotoField,
  AutoclaveTimeField,
} from '@/src/components/autoclave/DailyOpsFields';
import { DAILY_OPS_FIELD_KEYS } from '@/src/constants/autoclave';
import type { DailyOpsController } from '@/src/hooks/autoclave/useDailyOpsController';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

const PHOTO_ASPECT = 4 / 3;
const PHOTO_ASPECT_EMPTY = 16 / 9;

type DailyOpsRunningCardProps = {
  controller: DailyOpsController;
  registerFieldRef: DailyOpsRegisterFieldRef;
  onFieldFocus: DailyOpsFieldFocusHandler;
  onFieldBlur: DailyOpsFieldFocusHandler;
  openPicker: DailyOpsOpenPicker;
  onOpenCamera: () => void;
  saving: boolean;
};

export function DailyOpsRunningCard({
  controller,
  registerFieldRef,
  onFieldFocus,
  onFieldBlur,
  openPicker,
  onOpenCamera,
  saving,
}: DailyOpsRunningCardProps) {
  const {
    currentCycle,
    cycleDocLoading,
    cycleDocError,
    cycleDoc,
    formErrorField,
    setFormErrorField,
    unloadTime,
    internalIndicator,
    setInternalIndicator,
    externalIndicator,
    setExternalIndicator,
    photoUri,
    notes,
    setNotes,
    onFinishAndUnload,
    canPressFinishUnload,
    finishBlockers,
  } = controller;

  if (cycleDocLoading) {
    return (
      <View style={styles.centerInline}>
        <ActivityIndicator />
        <Text style={styles.helperText}>Loading current cycle...</Text>
      </View>
    );
  }

  if (cycleDocError) {
    return (
      <View style={styles.centerInline}>
        <Text style={styles.errorText}>{cycleDocError}</Text>
      </View>
    );
  }

  const temperatureText =
    typeof cycleDoc?.settings?.temperature === 'number'
      ? `${cycleDoc.settings.temperature}°C`
      : '--';

  const pressureText =
    typeof cycleDoc?.settings?.pressure === 'number'
      ? `${cycleDoc.settings.pressure} bar`
      : '--';

  const startedAtText =
    typeof cycleDoc?.cycleBeginTime === 'string' &&
    cycleDoc.cycleBeginTime.trim().length > 0
      ? cycleDoc.cycleBeginTime
      : '--';

  const startedByText =
    typeof cycleDoc?.cycleBeganBy?.userName === 'string' &&
    cycleDoc.cycleBeganBy.userName.trim().length > 0
      ? cycleDoc.cycleBeganBy.userName
      : 'Unknown';

  const notesRequired =
    internalIndicator === false || externalIndicator === false;

  return (
    <View style={styles.card}>
      <View style={styles.runningHeader}>
        <View style={styles.runningTitleRow}>
          <View style={styles.runningClockIcon}>
            <MaterialCommunityIcons name="clock-outline" size={22} color="#ea580c" />
          </View>

          <View style={styles.flexOne}>
            <Text style={styles.runningTitle}>Cycle In Progress</Text>
            <Text style={styles.runningCycleId}>Cycle {currentCycle}</Text>
          </View>
        </View>

        <View style={styles.startedByWrap}>
          <Text style={styles.startedByLabel}>STARTED BY</Text>

          <Text style={styles.startedByValue} numberOfLines={1}>
            {startedByText}
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>TEMP</Text>
          <Text style={styles.metricValue}>{temperatureText}</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>PRESSURE</Text>
          <Text style={styles.metricValue}>{pressureText}</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>STARTED AT</Text>
          <Text style={styles.metricValue}>{startedAtText}</Text>
        </View>
      </View>

      <AutoclaveTimeField
        ref={registerFieldRef(DAILY_OPS_FIELD_KEYS.unloadTime)}
        label="Unload Time"
        value={unloadTime}
        error={formErrorField === DAILY_OPS_FIELD_KEYS.unloadTime}
        onPress={() => {
          onFieldFocus(DAILY_OPS_FIELD_KEYS.unloadTime);

          if (formErrorField === DAILY_OPS_FIELD_KEYS.unloadTime) {
            setFormErrorField(null);
          }

          openPicker('unloadTime', 'time');
        }}
      />

      <View style={styles.verifySection}>
        <Text style={styles.verifyTitle}>Verification Check</Text>
        <View style={styles.verifyDivider} />

        <AutoclavePassFailField
          ref={registerFieldRef(DAILY_OPS_FIELD_KEYS.internalIndicator)}
          label="Internal Indicator"
          value={internalIndicator}
          error={formErrorField === DAILY_OPS_FIELD_KEYS.internalIndicator}
          onChange={(value) => {
            setInternalIndicator(value);

            if (formErrorField === DAILY_OPS_FIELD_KEYS.internalIndicator) {
              setFormErrorField(null);
            }
          }}
        />

        <AutoclavePassFailField
          ref={registerFieldRef(DAILY_OPS_FIELD_KEYS.externalIndicator)}
          label="External Indicator"
          value={externalIndicator}
          error={formErrorField === DAILY_OPS_FIELD_KEYS.externalIndicator}
          onChange={(value) => {
            setExternalIndicator(value);

            if (formErrorField === DAILY_OPS_FIELD_KEYS.externalIndicator) {
              setFormErrorField(null);
            }
          }}
        />

        <AutoclavePhotoField
          ref={registerFieldRef(DAILY_OPS_FIELD_KEYS.photoEvidence)}
          label="Photo Evidence"
          photoUri={photoUri}
          error={formErrorField === DAILY_OPS_FIELD_KEYS.photoEvidence}
          onPress={() => {
            onFieldFocus(DAILY_OPS_FIELD_KEYS.photoEvidence);

            if (formErrorField === DAILY_OPS_FIELD_KEYS.photoEvidence) {
              setFormErrorField(null);
            }

            onOpenCamera();
          }}
          aspectRatioFilled={PHOTO_ASPECT}
          aspectRatioEmpty={PHOTO_ASPECT_EMPTY}
        />

        <AutoclaveNotesField
          ref={registerFieldRef(DAILY_OPS_FIELD_KEYS.notes)}
          label={notesRequired ? 'Notes' : 'Notes (Optional)'}
          required={notesRequired}
          error={formErrorField === DAILY_OPS_FIELD_KEYS.notes}
          value={notes}
          onChangeText={setNotes}
          onFocus={() => onFieldFocus(DAILY_OPS_FIELD_KEYS.notes)}
          onBlur={() => onFieldBlur(DAILY_OPS_FIELD_KEYS.notes)}
        />

        <ActionBlockerList blockers={finishBlockers} />

        <Pressable
          onPress={onFinishAndUnload}
          disabled={!canPressFinishUnload}
          style={({ pressed }) => [
            styles.finishButton,
            !canPressFinishUnload && styles.finishButtonDisabled,
            pressed && canPressFinishUnload && { opacity: 0.92 },
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canPressFinishUnload }}
        >
          <Text style={styles.finishButtonText}>
            {saving ? 'Finishing…' : 'Finish & Unload'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerInline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  helperText: {
    color: '#666',
    fontWeight: '600',
  },
  errorText: {
    color: '#B00020',
    fontWeight: '700',
    textAlign: 'center',
  },
  card: {
    borderWidth: 1.5,
    borderColor: '#f0b86b',
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 18,
  },
  flexOne: {
    flex: 1,
  },
  runningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  runningTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  runningClockIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#f0b86b',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
  },
  runningTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#334155',
  },
  runningCycleId: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '700',
  },
  startedByWrap: {
    alignItems: 'flex-end',
    maxWidth: 120,
  },
  startedByLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.4,
  },
  startedByValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 14,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#94a3b8',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#334155',
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  verifySection: {
    marginTop: 8,
  },
  verifyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#334155',
  },
  verifyDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginTop: 10,
    marginBottom: 14,
  },
  finishButton: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#4361ee',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonDisabled: {
    opacity: 0.6,
  },
  finishButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
});
