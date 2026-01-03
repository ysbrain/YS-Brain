import { useProfile } from "@/src/contexts/ProfileContext";
import { db } from "@/src/lib/firebase";
import { useLocalSearchParams } from "expo-router";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

function prettyValue(v: any) {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (Array.isArray(v)) return JSON.stringify(v, null, 2);
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

export default function LogDetailScreen() {
  const profile = useProfile();
  const { recordId, docId } = useLocalSearchParams<{ recordId: string; docId: string }>();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // ✅ NEW: aspect ratio for the photo (width / height)
  const [photoAR, setPhotoAR] = useState<number | null>(null);

  useEffect(() => {
    const clinicId = profile?.clinic;
    if (!clinicId || !recordId || !docId) return;

    setLoading(true);
    setErrMsg(null);

    (async () => {
      try {
        const ref = doc(db, "clinics", clinicId, recordId, docId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setData(null);
          setErrMsg("Log not found.");
        } else {
          setData(snap.data());
        }
      } catch (e: any) {
        console.warn("Failed to load log detail", e);
        setErrMsg(e?.message ?? "Failed to load log detail.");
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.clinic, recordId, docId]);

  // Photo URL if present
  const photoUrl = useMemo(() => (data?.photoUrl as string | undefined), [data]);

  // ✅ NEW: compute remote image size => aspect ratio, so we can scale by width with no crop
  useEffect(() => {
    if (!photoUrl) {
      setPhotoAR(null);
      return;
    }

    Image.getSize(
      photoUrl,
      (w, h) => {
        if (w > 0 && h > 0) setPhotoAR(w / h);
        else setPhotoAR(null);
      },
      () => setPhotoAR(null)
    );
  }, [photoUrl]); // Image.getSize is the RN API for remote image dimensions

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.subtle}>Loading detail…</Text>
      </View>
    );
  }

  if (errMsg) {
    return (
      <View style={styles.center}>
        <Text style={[styles.subtle, { color: "#c00" }]}>{errMsg}</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.subtle}>No data.</Text>
      </View>
    );
  }

  // Sort keys for consistent display
  const keys = Object.keys(data).filter((k) => k !== "photoUrl").sort();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Doc: {docId}</Text>

      {/* ✅ Fields first */}
      <View style={styles.card}>
        {keys.map((k) => (
          <View key={k} style={styles.fieldRow}>
            <Text style={styles.fieldKey}>{k}</Text>
            <Text style={styles.fieldVal}>{prettyValue(data[k])}</Text>
          </View>
        ))}
      </View>

      {/* ✅ Photo at bottom (if present) */}
      {photoUrl ? (
        <View style={styles.photoSection}>
          <Text style={styles.photoLabel}>Photo</Text>

          <Image
            source={{ uri: photoUrl }}
            resizeMode="contain" // ✅ no crop: contain shows full image
            style={[
              styles.photo,
              // Fit to width; height derived from aspectRatio (remote images need dimensions)
              { aspectRatio: photoAR ?? 4 / 3 },
            ]}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  header: { fontSize: 22, fontWeight: "800" },
  subtle: { fontSize: 14, color: "#666", textAlign: "center" },

  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
    backgroundColor: '#007AFF22',
    padding: 12,
  },
  fieldRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  fieldKey: { fontSize: 12, color: "#777", marginBottom: 6, fontWeight: "700" },
  fieldVal: { fontSize: 14, color: "#222" },

  // ✅ Photo at bottom
  photoSection: { gap: 8 },
  photoLabel: { fontSize: 14, fontWeight: "800", color: "#222" },

  // Fit to screen width, height comes from aspectRatio
  photo: {
    width: "100%",
    height: undefined, // required when using aspectRatio to auto-compute height
    borderRadius: 12,
    backgroundColor: "#eee",
  },
});
