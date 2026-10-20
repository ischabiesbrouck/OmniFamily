/** localStorage key of the device preferences store (shared with stores/deviceStore.ts). */
export const DEVICE_STORE_KEY = 'omnifamily-device';

/**
 * Runs in <head> before first paint, so a chosen theme never flashes the other one.
 * Kept tiny and dependency-free because it is inlined as a string.
 */
export const THEME_BOOT_SCRIPT = `try{var t=JSON.parse(localStorage.getItem(${JSON.stringify(
  DEVICE_STORE_KEY,
)})||'{}').state;t=t&&t.theme;if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
