import { Ionicons } from '@expo/vector-icons';
import { Link, useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function Index() {
  const navigation = useNavigation();
  const { signOut } = useAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Ionicons
          name="log-out-outline"
          size={24}
          color="red"
          style={{ marginRight: 16 }}
          onPress={async () => {
            await signOut();
            router.replace("/(auth)/login");
          }}
        />
      ),
    });
  }, [navigation, signOut, router]);

  return (
    console.log("Rendering Home Screen"),
    <View style={styles.container}>
      <Text style={styles.text}>Home screen</Text>
      <Link href="/about" style={styles.button}>
        Go to About screen
      </Link>
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
  text: {
    color: '#fff',
  },
  button: {
    fontSize: 20,
    textDecorationLine: 'underline',
    color: '#fff',
  },
});
