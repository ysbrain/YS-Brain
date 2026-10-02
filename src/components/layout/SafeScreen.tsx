// src/components/layout/SafeScreen.tsx

import { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
};

export default function SafeScreen({
  children,
}: Props) {
  return (
    <SafeAreaView
      style={{ flex: 1 }}
      edges={['bottom']}
    >
      {children}
    </SafeAreaView>
  );
}
