// src/utils/keyboard.ts

import { Keyboard, TextInput } from 'react-native';

export function blurActiveInputAndDismissKeyboard() {
  const focusedInput = TextInput.State.currentlyFocusedInput?.();

  if (focusedInput && typeof focusedInput.blur === 'function') {
    focusedInput.blur();
  }

  Keyboard.dismiss();
}
