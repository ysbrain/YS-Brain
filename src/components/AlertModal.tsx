// src/components/AlertModal.tsx

import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onOk: () => void;
};

export function AlertModal({
  visible,
  title,
  message,
  onOk,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {title}
          </Text>

          <Text style={styles.message}>
            {message}
          </Text>

          <Pressable
            style={styles.button}
            onPress={onOk}
          >
            <Text style={styles.buttonText}>
              OK
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },

  title: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    paddingTop: 20,
  },

  message: {
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: '#444',
    lineHeight: 22,
  },

  button: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 16,
    alignItems: 'center',
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#102E5C',
  },
});
