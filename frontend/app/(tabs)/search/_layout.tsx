import { Stack } from 'expo-router';
import { colors, typography } from '../../../theme/tokens';

export default function SearchStackLayout() {
  return (
    <Stack
      screenOptions={{
        /** Large title + UISearchBar stacks excessive vertical chrome; Home uses a compact in-screen header. */
        headerLargeTitle: false,
        headerShadowVisible: false,
        headerTransparent: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textDark,
        headerLargeTitleStyle: {
          ...typography.title1,
          color: colors.textDark,
        },
        headerTitleStyle: {
          ...typography.heading,
          color: colors.textDark,
        },
        contentStyle: { backgroundColor: colors.surface },
      }}
    />
  );
}
