import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

type UseKeyboardHeightOptions = {
  enabled?: boolean;
};

export function useKeyboardHeight({ enabled = true }: UseKeyboardHeightOptions = {}): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') {
      setKeyboardHeight(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(Math.max(event.endCoordinates.height, 0));
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [enabled]);

  return keyboardHeight;
}

export default useKeyboardHeight;
