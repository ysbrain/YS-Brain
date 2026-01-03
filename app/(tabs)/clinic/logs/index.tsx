
import { useProfile } from "@/src/contexts/ProfileContext";
import { db } from "@/src/lib/firebase";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type LogRow = {
  id: string;
  username?: string | null;
  createdAt?: Timestamp | null;
  // keep full data if you want quick detail preview later:
  data: Record<string, any>;
};

function formatDateTime(d: Date, timeZone = "Asia/Hong_Kong") {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone,
    })
      .format(d)
      .replace(/,/g, "");
  } catch {
    return `${d.toDateString()} ${d.toTimeString().slice(0, 8)}`;
  }
}

export default function LogsScreen() {
  const router = useRouter();
  const profile = useProfile();

  const { recordId } = useLocalSearchParams<{ recordId: string }>();

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const clinicId = profile?.clinic;

  // Basic param validation (helps avoid silent failures)
  const canQuery = useMemo(() => Boolean(clinicId && recordId), [clinicId, recordId]);

  useEffect(() => {
    if (!canQuery) return;

    setLoading(true);
    setErrMsg(null);

    const colRef = collection(db, "clinics", clinicId!, recordId!);
    const q = query(colRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: LogRow[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            username: data?.username ?? null,
            createdAt: (data?.createdAt as Timestamp) ?? null,
            data,
          };
        });
        setLogs(items);
        setLoading(false);
      },
      (err) => {
        console.warn("Logs query failed", err);
        setErrMsg(err?.message ?? "Failed to load logs.");
        setLoading(false);
      }
    );

    return unsub;
  }, [canQuery, clinicId, recordId]);

  const openDetail = (docId: string) => {
    router.push({
      pathname: "/clinic/logs/[docId]",
      params: { docId, recordId }, // pass recordId along so detail knows collection path
    });
  };

  if (!canQuery) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Logs</Text>
        <Text style={styles.subtle}>
          Missing required parameters (recordId) or profile.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.subtle}>Loading logs…</Text>
      </View>
    );
  }

  if (errMsg) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Logs</Text>
        <Text style={[styles.subtle, { color: "#c00" }]}>{errMsg}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.header}>Record: {recordId}</Text>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={logs.length === 0 ? styles.center : undefined}
        ListEmptyComponent={
          <Text style={styles.subtle}>No logs found.</Text>
        }
        renderItem={({ item }) => {
          const created =
            item.createdAt?.toDate?.() ?? null;

          const createdText = created
            ? formatDateTime(created)
            : "Unknown time";

          const usernameText = item.username ?? "Unknown user";

          return (
            <Pressable style={styles.row} onPress={() => openDetail(item.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{createdText}</Text>
                <Text style={styles.rowSubtitle}>By: {usernameText}</Text>
              </View>

              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  header: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  subtle: { fontSize: 14, color: "#666", textAlign: "center" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
    marginBottom: 10,
    backgroundColor: '#007AFF22',
  },
  rowTitle: { fontSize: 16, fontWeight: "700", color: "#222" },
  rowSubtitle: { fontSize: 13, color: "#555", marginTop: 4 },
  chevron: { fontSize: 22, color: "#999", marginLeft: 10 },
});
