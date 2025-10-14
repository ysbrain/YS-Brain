import { auth } from '@/src/lib/auth';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);

  async function signIn() {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) { setError(e.message); }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back 👋</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>      

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={"#999"}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextInput
        ref={passwordRef}
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={"#999"}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {!!error && <Text style={{ color: 'red' }}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={signIn}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 50,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  footerText: {
    marginTop: 24,
    textAlign: "center",
    color: "#666",
  },
  link: {
    color: "#007AFF",
    fontWeight: "600",
  },
});
