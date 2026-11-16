import { Accents, Colors, Surface } from '@/constants/theme';
import { usePreferences } from '@/preferences/preferences-provider';

/** Color tokens for the user's chosen theme (system / light / dark) and accent color, plus the scheme's surface treatment. */
export function useTheme() {
  const { scheme, accent } = usePreferences();
  return { ...Colors[scheme], ...Surface[scheme], primary: Accents[accent][scheme] };
}
