import { useProfile } from '@/src/contexts/ProfileContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
// Reusable Date component (format: "21 Oct 2025")
import DateText from '@/src/components/DateText';
// Firestore
import { useAuth } from '@/src/contexts/AuthContext';
import { db } from '@/src/lib/firebase'; // your initialized Firestore
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

// For "Last uploaded time" display
function formatDateTime(d: Date, timeZone = 'Asia/Hong_Kong') {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone
    })
      .format(d)
      .replace(/,/g, '');
  } catch {
    return `${d.toDateString()} ${d.toTimeString().slice(0, 8)}`;
  }
}

export default function TemperatureScreen() {
  const router = useRouter();
  const profile = useProfile();
  const equipmentId = useLocalSearchParams<{ equipmentId: string }>().equipmentId;
  const { user } = useAuth();
  const recordId = `temperature${equipmentId}`;
  
  const [temperatureText, setTemperatureText] = useState<string>('');
  const [temperatureValue, setTemperatureValue] = useState<number | null>(null);
  const [temperatureError, setTemperatureError] = useState<string | null>(null);

  // ⏱️ Last uploaded time — now driven by the newest doc in the collection
  const [lastUploadedAt, setLastUploadedAt] = useState<Date | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  // Upload: require results
  const [uploading, setUploading] = useState(false);
  const canUpload = temperatureValue !== null && !uploading;

  // 🔁 Subscribe to the newest entry (by createdAt DESC, LIMIT 1)
  useEffect(() => {
    if (!profile?.clinic || !recordId) return;

    const col = collection(db, 'clinics', profile.clinic, recordId);
    const q = query(col, orderBy('createdAt', 'desc'), limit(1));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setLastUploadedAt(null);
        } else {
          const data = snap.docs[0].data();
          const ts = data?.createdAt as Timestamp | undefined;
          setLastUploadedAt(ts ? ts.toDate() : null);
        }
        setLoadingStatus(false);
      },
      (err) => {
        console.warn('Failed to load latest upload time', err);
        setLoadingStatus(false);
      }
    );
    return unsubscribe;
  }, [profile?.clinic, recordId]);    
  
  const sanitizeForTyping = (raw: string) => {
    // Normalize comma to dot, remove spaces
    let s = raw.replace(/\s+/g, '').replace(',', '.');

    // Keep only digits and dot
    s = s.replace(/[^0-9.]/g, '');

    // Keep only the first dot
    const firstDot = s.indexOf('.');
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    }

    // Split parts (do NOT remove leading zeros here)
    const [intRaw = '', decRaw = ''] = s.split('.');

    // Limit to "99.9" shape while typing:
    // - integer: up to 2 digits
    // - decimal: up to 1 digit
    const intPart = intRaw.slice(0, 2);
    const hasDot = s.includes('.');
    const decPart = decRaw.slice(0, 1);

    // Rebuild
    const text = hasDot ? `${intPart}.${decPart}` : intPart;

    // Compute a value only when it's not an incomplete decimal like "12."
    // (i.e., if it ends with '.' and no decimal digit yet => value null)
    const incompleteDecimal = hasDot && decPart.length === 0 && raw.includes('.');
    if (text === '' || text === '.' || incompleteDecimal) {
      return { text: text === '.' ? '0.' : text, value: null, error: null };
    }

    const num = Number.parseFloat(text);
    if (Number.isNaN(num)) return { text, value: null, error: null };

      // Validate range while typing (optional but recommended)
    if (num < 0 || num > 99.9) {
      return { text, value: null, error: 'Enter 0.0 to 99.9' };
    }

    return { text, value: num, error: null };
  };  
  
  const onChangeTemperature = (text: string) => {
    const { text: cleaned, value, error } = sanitizeForTyping(text);
    setTemperatureText(cleaned);
    setTemperatureValue(value);
    setTemperatureError(error);
  };
  
  const normalizeTemperatureOnBlur = () => {
    const raw = temperatureText.trim().replace(',', '.');

    // If empty, do nothing
    if (!raw) {
      setTemperatureValue(null);
      setTemperatureError(null);
      return;
    }

    // Handle cases like "0." or "12." -> treat as "0.0" / "12.0"
    const candidate = raw.endsWith('.') ? `${raw}0` : raw;

    const num = Number.parseFloat(candidate);

    if (Number.isNaN(num)) {
      setTemperatureValue(null);
      setTemperatureError('Enter 0.0 to 99.9');
      return;
    }

    if (num < 0 || num > 99.9) {
      setTemperatureValue(null);
      setTemperatureError('Enter 0.0 to 99.9');
      return;
    }

    // ✅ This enforces 1 decimal place AND removes leading zeros
    // "09.5" -> 9.5 -> "9.5"
    // "00.0" -> 0 -> "0.0"
    // "36"   -> 36 -> "36.0"
    const formatted = num.toFixed(1);

    setTemperatureText(formatted);
    setTemperatureValue(num);
    setTemperatureError(null);
  };

  const handleUpload = async () => {    
    if (temperatureValue === null) {
      Alert.alert('Invalid temperature', 'Please enter a valid temperature.');
      return;
    }

    if (!user) return;
    
    try {
      setUploading(true);

      const entriesRef = collection(db, 'clinics', profile.clinic, recordId);

      await addDoc(entriesRef, {
        username: profile?.name ?? null,
        userID: user.uid,
        clinic: profile?.clinic ?? null,
        temperature: temperatureValue,
        createdAt: serverTimestamp(),
      });

      // Completed message, then go back when dismissed
      Alert.alert(
        'Completed',
        'Temperature uploaded successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ],
        {
          cancelable: false, // prevents dismiss by tapping outside / back button
        }
      );
    } catch (e: any) {
      console.error(e);
      Alert.alert('Upload failed', e?.message ?? 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!profile) return <Text>No profile found.</Text>;

  return (
    /* Content area: sticks to top below header */
    <View style={styles.container}>
      <View style={styles.content}>  
        {/* ✅ Header row: Date (left) + Profile (right) */}
        <View style={styles.headerRow}>
          <DateText style={styles.label} />
          {profile ? (
            <Text style={styles.profileRight} numberOfLines={1}>
              {profile.clinic} - {profile.name}
            </Text>
          ) : (
            <Text style={styles.profileRight}>Loading profile…</Text>
          )}
        </View>
        
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Temperature (°C)</Text>
          
          <TextInput
            value={temperatureText}
            onChangeText={onChangeTemperature}
            onBlur={normalizeTemperatureOnBlur}
            placeholder="e.g. 36.5"
            keyboardType="decimal-pad"
            inputMode="decimal"
            maxLength={4}              // "99.9"
            returnKeyType="done"
            style={[styles.input, temperatureError ? styles.inputError : null]}
          />

          {!!temperatureError && (
            <Text style={styles.errorText}>{temperatureError}</Text>
          )}
        </View>
      </View>
  
      {/* Footer stays at bottom: Upload button + Last uploaded */}
      <View style={styles.footer}>        
        <Pressable
          onPress={handleUpload}
          disabled={!canUpload}
          style={[styles.uploadBtn, !canUpload && styles.uploadBtnDisabled]}
        >          
          <Text style={styles.uploadBtnText}>
            {uploading ? 'Uploading…' : 'Upload'}
          </Text>
        </Pressable>
  
        <View style={styles.lastRow}>
          <Text style={styles.lastLabel}>Last uploaded:</Text>
          {loadingStatus ? (
            <Text style={styles.lastValue}>Loading…</Text>
          ) : lastUploadedAt ? (
            <Text style={styles.lastValue}>{formatDateTime(lastUploadedAt)}</Text>
          ) : (
            <Text style={styles.lastValue}>No uploads yet</Text>
          )}
        </View>
      </View>
    </View>
  );
}
  
const styles = StyleSheet.create({
  // Page layout: content at top, footer at bottom
  container: { flex: 1, paddingHorizontal: 16 },
  content: { paddingTop: 16, gap: 16 }, // starts right below header
  footer: { marginTop: 'auto', paddingTop: 12, paddingBottom: 12, gap: 8 },
  
  // Header row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  
  label: { fontSize: 18, color: '#444' },
    profileRight: {
    fontSize: 16,
    color: '#444',
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1
  },
  
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: '#C7C7CC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    color: '#111',
  },

  inputError: {
    borderColor: '#FF3B30',
  },

  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  
  // Buttons
  primaryBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  // Footer controls
  uploadBtn: {
    marginTop: 12,
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  uploadBtnDisabled: { backgroundColor: '#bbb' },
  uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  lastRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lastLabel: { fontSize: 12, color: '#666' },
  lastValue: { fontSize: 12, color: '#333' }
});
