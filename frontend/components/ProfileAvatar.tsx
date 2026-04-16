import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, typography } from '../theme/tokens';

type ProfileAvatarProps = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function getAvatarInitial(name?: string | null) {
  const trimmed = name?.trim();
  if (!trimmed) {
    return '?';
  }
  return trimmed.charAt(0).toUpperCase();
}

export default function ProfileAvatar({
  uri,
  name,
  size = 48,
  style,
  textStyle,
}: ProfileAvatarProps) {
  const imageStyle = style as StyleProp<ImageStyle>;
  const initialFontSize = Math.max(14, Math.round(size * 0.42));
  const avatarShape = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (uri) {
    return <Image source={{ uri }} style={[styles.base, avatarShape, imageStyle]} />;
  }

  return (
    <View style={[styles.base, styles.placeholder, avatarShape, style]}>
      <Text
        style={[
          styles.initialText,
          {
            fontSize: initialFontSize,
            lineHeight: Math.ceil(initialFontSize * 1.1),
          },
          textStyle,
        ]}
      >
        {getAvatarInitial(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.border,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.location,
    borderWidth: 1,
    borderColor: colors.border,
  },
  initialText: {
    fontFamily: typography.heading.fontFamily,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 0,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
