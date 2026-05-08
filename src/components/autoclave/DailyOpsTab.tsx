// src/components/autoclave/DailyOpsTab.tsx

import { ActionBlockerList, type ActionBlocker } from '@/src/components/autoclave/ActionBlockerList';
import {
  AutoclaveNotesField,
  AutoclavePassFailField,
  AutoclavePhotoField,
  AutoclaveReadonlyField,
  AutoclaveTextField,
  AutoclaveTimeField,
} from '@/src/components/autoclave/DailyOpsFields';
import type {
  DailyOpsCycleDoc,
  DailyOpsFieldKey,
} from '@/src/hooks/autoclave/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const PHOTO_ASPECT = 4 / 3;
const PHOTO_ASPECT_EMPTY = 16 / 9;


function sanitizeThreeDigitNumberInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 3);
}

type PickerField = 'startTime' | 'unloadTime';

type DailyOpsTabProps = {
  isRunning: boolean;

  cycleIdPreview: string;

  currentCycle: string;
  cycleDocLoading: boolean;
  cycleDocError: string | null;
  cycleDoc: DailyOpsCycleDoc | null;

  formErrorField: DailyOpsFieldKey | null;
  setFormErrorField: (field: DailyOpsFieldKey | null) => void;

  maxTemp: string;
  setMaxTemp: (value: string) => void;

  pressure: string;
  setPressure: (value: string) => void;

  startTime: string;
  unloadTime: string;

  internalIndicator: boolean | null;
  setInternalIndicator: (value: boolean | null) => void;

  externalIndicator: boolean | null;
  setExternalIndicator: (value: boolean | null) => void;

  photoUri: string | null;

  notes: string;
  setNotes: (value: string) => void;

  registerFieldRef: (key: DailyOpsFieldKey) => (ref: any) => void;
  onFieldFocus: (key: DailyOpsFieldKey) => void;
  onFieldBlur: (key: DailyOpsFieldKey) => void;

  openPicker: (field: PickerField, mode: 'time') => void;
  onOpenCamera: () => void;

  onStartMachine: () => void;
  onFinishAndUnload: () => void;

  canPressStartMachine: boolean;
  canPressFinishUnload: boolean;

  startBlockers: ActionBlocker[];
  finishBlockers: ActionBlocker[];

  saving: boolean;
};

export function DailyOpsTab({
  isRunning,

  cycleIdPreview,

  currentCycle,
  cycleDocLoading,
  cycleDocError,
  cycleDoc,

  formErrorField,
  setFormErrorField,

  maxTemp,
  setMaxTemp,

  pressure,
  setPressure,

  startTime,
  unloadTime,

  internalIndicator,
  setInternalIndicator,

  externalIndicator,
  setExternalIndicator,

  photoUri,

  notes,
  setNotes,

  registerFieldRef,
  onFieldFocus,
  onFieldBlur,

  openPicker,
  onOpenCamera,

  onStartMachine,
  onFinishAndUnload,

  canPressStartMachine,
  canPressFinishUnload,

  startBlockers,
  finishBlockers,

  saving,
}: DailyOpsTabProps) {
  const renderStart = () => {
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
              ref={registerFieldRef('daily:maxTemp')}
              label="Max Temp (°C)"
              value={maxTemp}
              onChangeText={(t) => {
                setMaxTemp(sanitizeThreeDigitNumberInput(t));

                if (formErrorField === 'daily:maxTemp') {
                  setFormErrorField(null);
                }
              }}
              placeholder="Enter temp"
              error={formErrorField === 'daily:maxTemp'}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              maxLength={3}
              onFocus={() => onFieldFocus('daily:maxTemp')}
              onBlur={() => onFieldBlur('daily:maxTemp')}
            />
          </View>

          <View style={styles.twoColItem}>
            <AutoclaveTextField
              ref={registerFieldRef('daily:pressure')}
              label="Pressure"
              value={pressure}
              onChangeText={(t) => {
                setPressure(sanitizeThreeDigitNumberInput(t));

                if (formErrorField === 'daily:pressure') {
                  setFormErrorField(null);
                }
              }}
              placeholder="Enter pressure"
              error={formErrorField === 'daily:pressure'}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              maxLength={3}
              onFocus={() => onFieldFocus('daily:pressure')}
              onBlur={() => onFieldBlur('daily:pressure')}
            />
          </View>
        </View>

        <AutoclaveTimeField
          ref={registerFieldRef('daily:startTime')}
          label="Start Time"
          value={startTime}
          error={formErrorField === 'daily:startTime'}
          onPress={() => {
            onFieldFocus('daily:startTime');

            if (formErrorField === 'daily:startTime') {
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
  };

  const renderRunning = () => {
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
        ? String(cycleDoc.settings.pressure)
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

    return (
      <View style={styles.card}>
        <View style={styles.runningHeader}>
          <View style={styles.runningTitleRow}>
            <View style={styles.runningClockIcon}>
              <MaterialCommunityIcons name="clock-outline" size={22} color="#ea580c" />
            </View>

            <View style={{ flex: 1 }}>
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
          ref={registerFieldRef('daily:unloadTime')}
          label="Unload Time"
          value={unloadTime}
          error={formErrorField === 'daily:unloadTime'}
          onPress={() => {
            onFieldFocus('daily:unloadTime');

            if (formErrorField === 'daily:unloadTime') {
              setFormErrorField(null);
            }

            openPicker('unloadTime', 'time');
          }}
        />

        <View style={styles.verifySection}>
          <Text style={styles.verifyTitle}>Verification Check</Text>
          <View style={styles.verifyDivider} />

          <AutoclavePassFailField
            ref={registerFieldRef('daily:internalIndicator')}
            label="Internal Indicator"
            value={internalIndicator}
            error={formErrorField === 'daily:internalIndicator'}
            onChange={(value) => {
              setInternalIndicator(value);

              if (formErrorField === 'daily:internalIndicator') {
                setFormErrorField(null);
              }
            }}
          />

          <AutoclavePassFailField
            ref={registerFieldRef('daily:externalIndicator')}
            label="External Indicator"
            value={externalIndicator}
            error={formErrorField === 'daily:externalIndicator'}
            onChange={(value) => {
              setExternalIndicator(value);

              if (formErrorField === 'daily:externalIndicator') {
                setFormErrorField(null);
              }
            }}
          />

          <AutoclavePhotoField
            ref={registerFieldRef('daily:photoEvidence')}
            label="Photo Evidence"
            photoUri={photoUri}
            error={formErrorField === 'daily:photoEvidence'}
            onPress={() => {
              onFieldFocus('daily:photoEvidence');

              if (formErrorField === 'daily:photoEvidence') {
                setFormErrorField(null);
              }

              onOpenCamera();
            }}
            aspectRatioFilled={PHOTO_ASPECT}
            aspectRatioEmpty={PHOTO_ASPECT_EMPTY}
          />

          <AutoclaveNotesField
            ref={registerFieldRef('daily:notes')}
            label="Notes (Optional)"
            value={notes}
            onChangeText={setNotes}
            onFocus={() => onFieldFocus('daily:notes')}
            onBlur={() => onFieldBlur('daily:notes')}
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
  };

  return isRunning ? renderRunning() : renderStart();
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
