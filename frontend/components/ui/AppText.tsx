import { Text, type TextProps } from 'react-native';
import { typography, colors } from '../../theme/tokens';

export type AppTextVariant =
  | 'title1'
  | 'title2'
  | 'heading'
  | 'body'
  | 'subhead'
  | 'footnote'
  | 'footnoteMed';

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  color?: keyof typeof colors | string;
  children: React.ReactNode;
}

export function AppText({
  variant = 'body',
  color = 'text',
  style,
  children,
  ...props
}: AppTextProps) {
  const resolvedColor = color in colors ? colors[color as keyof typeof colors] : color;

  return (
    <Text style={[typography[variant], { color: resolvedColor }, style]} {...props}>
      {children}
    </Text>
  );
}
