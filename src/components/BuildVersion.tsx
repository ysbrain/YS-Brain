import { StyleSheet, Text, View } from "react-native";

const buildTimestamp =
  process.env.EXPO_PUBLIC_BUILD_TIMESTAMP ?? "Development build";

function formatBuildTimestamp(timestamp: string): string {
  if (timestamp === "Development build") {
    return timestamp;
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat("en-HK", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Hong_Kong",
    hour12: false,
  }).format(date);
}

export function BuildVersion() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Build: {formatBuildTimestamp(buildTimestamp)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 8,
  },

  text: {
    color: "#6B7280",
    fontSize: 12,
  },
});
