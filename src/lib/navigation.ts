import { type Href, router } from 'expo-router';

/** Back if there is history (normal in-app flow), otherwise go to `fallback` (deep link / refresh on web). */
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
