/** Every page of the app. All are static and precached, so each one opens offline. */
export const APP_ROUTES = [
  '/',
  '/calendar',
  '/tasks',
  '/groceries',
  '/settings',
  '/help',
  '/onboarding',
  '/kiosk',
] as const;
