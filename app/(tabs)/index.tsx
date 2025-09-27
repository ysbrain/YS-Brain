import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

export default function Index() {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button}>
        <Ionicons name="notifications-outline" size={30} style={styles.icon} />
        <Text style={styles.buttonText}>Notifications</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button}>
        <Ionicons name="warning-outline" size={30} style={styles.icon} />
        <Text style={styles.buttonText}>Warnings</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button}>
        <Ionicons name="link-outline" size={30} style={styles.icon} />
        <Text style={styles.buttonText}>Useful links</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button}>
        <Ionicons name="game-controller-outline" size={30} style={styles.icon} />
        <Text style={styles.buttonText}>Dr. Wah's games</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginVertical: 20,
    width: 300,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    color: '#fff',
    marginRight: 18,
  },
  buttonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
});
