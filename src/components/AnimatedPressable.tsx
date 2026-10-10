import { ReactNode, useMemo } from 'react';
import { Animated, GestureResponderEvent, Pressable, StyleProp, ViewStyle } from 'react-native';

export default function AnimatedPressable({
  children,
  onPress,
  style,
  echelleAppui = 0.96,
  disabled,
}: {
  children: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  echelleAppui?: number;
  disabled?: boolean;
}) {
  const echelle = useMemo(() => new Animated.Value(1), []);

  function anime(valeur: number) {
    Animated.spring(echelle, {
      toValue: valeur,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  }

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => anime(echelleAppui)}
      onPressOut={() => anime(1)}
      onPress={onPress}
    >
      <Animated.View style={[style, { transform: [{ scale: echelle }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
