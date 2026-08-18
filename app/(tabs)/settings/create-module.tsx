// app/(tabs)/settings/create-module.tsx

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';

import { db } from '@/src/lib/firebase';
import { toFirestoreSafeKey } from '@/src/utils/firestoreKeys';

type FirestoreRecordFieldType =
  | 'string'
  | 'number'
  | 'passFail'
  | 'yesNo'
  | 'date'
  | 'time'
  | 'photo';

type UiRecordFieldType =
  | 'text'
  | 'number'
  | 'passFail'
  | 'yesNo'
  | 'date'
  | 'time'
  | 'photo';

type DraftRecordField = {
  id: string;
  field: string;
  required: boolean;
  type: FirestoreRecordFieldType;
  typeLabel: string;
};

const FIELD_TYPE_OPTIONS: Array<{
  uiType: UiRecordFieldType;
  label: string;
  firestoreType: FirestoreRecordFieldType;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}> = [
  {
    uiType: 'text',
    label: 'Text',
    firestoreType: 'string',
    icon: 'form-textbox',
  },
  {
    uiType: 'number',
    label: 'Number',
    firestoreType: 'number',
    icon: 'numeric',
  },
  {
    uiType: 'passFail',
    label: 'Pass/Fail',
    firestoreType: 'passFail',
    icon: 'check-decagram-outline',
  },
  {
    uiType: 'yesNo',
    label: 'Yes/No',
    firestoreType: 'yesNo',
    icon: 'toggle-switch-outline',
  },
  {
    uiType: 'date',
    label: 'Date',
    firestoreType: 'date',
    icon: 'calendar-month-outline',
  },
  {
    uiType: 'time',
    label: 'Time',
    firestoreType: 'time',
    icon: 'clock-outline',
  },
  {
    uiType: 'photo',
    label: 'Photo',
    firestoreType: 'photo',
    icon: 'camera-outline',
  },
];

function createDraftId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function CreateApplianceModuleScreen() {
  const router = useRouter();

  const [moduleName, setModuleName] = useState('');
  const [description, setDescription] = useState('');

  const [recordFields, setRecordFields] = useState<DraftRecordField[]>([]);

  const [fieldBuilderOpen, setFieldBuilderOpen] = useState(false);
  const [selectedFieldType, setSelectedFieldType] =
    useState<(typeof FIELD_TYPE_OPTIONS)[number] | null>(null);
  const [draftFieldName, setDraftFieldName] = useState('');
  const [draftRequired, setDraftRequired] = useState(true);

  const [saving, setSaving] = useState(false);

  const generatedModuleKey = useMemo(() => {
    return toFirestoreSafeKey(moduleName, {
      maxLength: 60,
      fallback: 'custom_module',
      separator: '_',
      lowercase: true,
      includeHash: false,
    });
  }, [moduleName]);

  const resetFieldBuilder = useCallback(() => {
    setFieldBuilderOpen(false);
    setSelectedFieldType(null);
    setDraftFieldName('');
    setDraftRequired(true);
  }, []);

  const openFieldBuilder = useCallback(() => {
    setFieldBuilderOpen(true);
    setSelectedFieldType(null);
    setDraftFieldName('');
    setDraftRequired(true);
  }, []);

  const addRecordField = useCallback(() => {
    const trimmedName = draftFieldName.trim();

    if (!selectedFieldType) {
      Alert.alert('Select type', 'Please choose a record field type.');
      return;
    }

    if (!trimmedName) {
      Alert.alert('Field name required', 'Please enter a record field name.');
      return;
    }

    const duplicate = recordFields.some(
      (item) => item.field.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    if (duplicate) {
      Alert.alert(
        'Duplicate field',
        'A record field with this name already exists.',
      );
      return;
    }

    setRecordFields((prev) => [
      ...prev,
      {
        id: createDraftId(),
        field: trimmedName,
        required: draftRequired,
        type: selectedFieldType.firestoreType,
        typeLabel: selectedFieldType.label,
      },
    ]);

    resetFieldBuilder();
  }, [
    draftFieldName,
    draftRequired,
    selectedFieldType,
    recordFields,
    resetFieldBuilder,
  ]);

  const removeRecordField = useCallback((id: string) => {
    setRecordFields((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const onCreateModule = useCallback(async () => {
    const trimmedModuleName = moduleName.trim();
    const trimmedDescription = description.trim();

    if (!trimmedModuleName) {
      Alert.alert('Module Name required', 'Please enter a Module Name.');
      return;
    }

    if (!trimmedDescription) {
      Alert.alert('Description required', 'Please enter a Description.');
      return;
    }

    if (recordFields.length === 0) {
      Alert.alert(
        'Record Fields required',
        'Please add at least one record field.',
      );
      return;
    }

    if (saving) return;

    setSaving(true);

    try {
      const modulesRef = collection(db, 'applianceModules');
      const moduleRef = doc(modulesRef, generatedModuleKey);

      const existingSnap = await getDoc(moduleRef);

      if (existingSnap.exists()) {
        Alert.alert(
          'Module already exists',
          `A module document named "${generatedModuleKey}" already exists. Please change the Module Name.`,
        );
        return;
      }

      /**
       * For now, module docs cannot be removed.
       * So moduleIndex = number of existing module docs + 1.
       */
      const existingModulesSnap = await getDocs(modulesRef);
      const moduleIndex = existingModulesSnap.size + 1;

      await setDoc(moduleRef, {
        moduleName: trimmedModuleName,
        description: trimmedDescription,
        moduleIndex,
        official: false,
        recordFields: recordFields.map((item) => ({
          field: item.field,
          required: item.required,
          type: item.type,
        })),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert(
        'Created',
        'Custom appliance module created successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ],
        { cancelable: false },
      );
    } catch (err: any) {
      console.error('create appliance module error', err);
      Alert.alert('Create failed', err?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [
    moduleName,
    description,
    recordFields,
    generatedModuleKey,
    saving,
    router,
  ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Create Module',
        }}
      />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Appliance Module Info</Text>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>
                Module Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                value={moduleName}
                onChangeText={setModuleName}
                placeholder="e.g. Ultrasonic Machine"
                placeholderTextColor="#94a3b8"
                style={styles.textInput}
                autoCapitalize="words"
              />
              {!!moduleName.trim() && (
                <Text style={styles.helperText}>
                  Firestore ID: {generatedModuleKey}
                </Text>
              )}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>
                Description <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Daily record of appliance functionality"
                placeholderTextColor="#94a3b8"
                style={[styles.textInput, styles.notesInput]}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>Record Fields</Text>

              <Pressable
                onPress={openFieldBuilder}
                style={({ pressed }) => [
                  styles.addFieldButton,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={18}
                  color="#111"
                />
                <Text style={styles.addFieldButtonText}>Field</Text>
              </Pressable>
            </View>

            {recordFields.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  No record fields added yet.
                </Text>
              </View>
            ) : (
              <View style={styles.recordFieldList}>
                {recordFields.map((item, index) => (
                  <View key={item.id} style={styles.recordFieldRow}>
                    <View style={styles.recordFieldIndex}>
                      <Text style={styles.recordFieldIndexText}>
                        {index + 1}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.recordFieldName} numberOfLines={1}>
                        {item.field}
                      </Text>
                      <Text style={styles.recordFieldMeta}>
                        {item.typeLabel} •{' '}
                        {item.required ? 'Required' : 'Optional'}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => removeRecordField(item.id)}
                      style={({ pressed }) => [
                        styles.removeFieldButton,
                        pressed && { opacity: 0.7 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.field}`}
                    >
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={20}
                        color="#B00020"
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>          
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={onCreateModule}
            disabled={saving}
            style={({ pressed }) => [
              styles.createButton,
              saving && styles.createButtonDisabled,
              pressed && !saving && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>Create Module</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={fieldBuilderOpen}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={resetFieldBuilder}
      >
        <View style={styles.modalKeyboardView}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={resetFieldBuilder}
            accessibilityRole="button"
            accessibilityLabel="Close add record field modal"
          >
            <Pressable
              style={styles.modalCard}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Add Record Field
                </Text>

                <Pressable
                  onPress={resetFieldBuilder}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.modalCloseButton,
                    pressed && { opacity: 0.65 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Close add record field modal"
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={22}
                    color="#111"
                  />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Field Name */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>
                    Field Name <Text style={styles.required}>*</Text>
                  </Text>

                  <TextInput
                    value={draftFieldName}
                    onChangeText={setDraftFieldName}
                    placeholder="e.g. Functionality Check"
                    placeholderTextColor="#94a3b8"
                    style={styles.textInput}
                    autoCapitalize="words"
                    returnKeyType="done"
                  />
                </View>

                {/* Field Type */}
                <Text style={styles.fieldLabel}>
                  Field Type <Text style={styles.required}>*</Text>
                </Text>

                <View style={styles.typeGrid}>
                  {FIELD_TYPE_OPTIONS.map((option) => {
                    const active =
                      selectedFieldType?.uiType === option.uiType;

                    return (
                      <Pressable
                        key={option.uiType}
                        onPress={() => setSelectedFieldType(option)}
                        style={({ pressed }) => [
                          styles.typeOption,
                          active && styles.typeOptionActive,
                          pressed && { opacity: 0.85 },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${option.label} field type`}
                      >
                        <MaterialCommunityIcons
                          name={option.icon}
                          size={22}
                          color={active ? '#2563eb' : '#475569'}
                        />

                        <Text
                          style={[
                            styles.typeOptionText,
                            active && styles.typeOptionTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Required Field */}
                <View style={styles.requiredRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requiredTitle}>
                      Required Field
                    </Text>

                    <Text style={styles.requiredSubtitle}>
                      Turn off if this field is optional.
                    </Text>
                  </View>

                  <Switch
                    value={draftRequired}
                    onValueChange={setDraftRequired}
                  />
                </View>

                {/* Actions */}
                <View style={styles.builderActions}>
                  <Pressable
                    onPress={resetFieldBuilder}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && { opacity: 0.85 },
                    ]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryButtonText}>
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={addRecordField}
                    style={({ pressed }) => [
                      styles.confirmFieldButton,
                      pressed && { opacity: 0.85 },
                    ]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.confirmFieldButtonText}>
                      Confirm Field
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#fff',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111',
    marginBottom: 12,
  },
  fieldBlock: {
    gap: 8,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111',
  },
  required: {
    color: '#B00020',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    backgroundColor: '#fff',
  },
  notesInput: {
    minHeight: 88,
  },
  helperText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  addFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  addFieldButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111',
  },
  emptyBox: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#f8fafc',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontWeight: '700',
  },
  recordFieldList: {
    gap: 10,
  },
  recordFieldRow: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordFieldIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordFieldIndexText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  recordFieldName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111',
  },
  recordFieldMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  removeFieldButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
    marginBottom: 14,
  },
  typeOption: {
    width: '47%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    gap: 6,
  },
  typeOptionActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#475569',
  },
  typeOptionTextActive: {
    color: '#2563eb',
  },
  requiredRow: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  requiredTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111',
  },
  requiredSubtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  builderActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111',
  },
  confirmFieldButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#2563eb',
  },
  confirmFieldButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f0fff4ff',
  },
  createButton: {
    borderRadius: 999,
    paddingVertical: 15,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },

  modalKeyboardView: {
    flex: 1,
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },

  modalCard: {
    width: '100%',
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 22,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },

  modalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    color: '#111',
  },

  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },

  modalScroll: {
    flexGrow: 0,
  },

  modalContent: {
    padding: 16,
  },
});
