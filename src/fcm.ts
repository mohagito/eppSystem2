import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { db, auth } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { initializeApp } from 'firebase/app';

// Safety wrapper to avoid crashes on non-browser / unsupported runtimes (e.g. iFrame restrictions, old browsers)
let messagingInstance: Messaging | null = null;
let isFcmSupportedVal = false;

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
  try {
    const app = initializeApp(firebaseConfig);
    messagingInstance = getMessaging(app);
    isFcmSupportedVal = true;
  } catch (err) {
    console.warn('Firebase Cloud Messaging is not supported or was blocked by browser security guidelines:', err);
  }
}

export const messaging = messagingInstance;
export const isFcmSupported = () => isFcmSupportedVal;

/**
 * Request notification permissions and register FCM token.
 * Stores token per authenticated user in their Firestore profile.
 */
export async function setupFcmToken(userId: string): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!isFcmSupported() || !messaging) {
    return { success: false, error: 'FCM is not supported in this browser environment.' };
  }

  try {
    // 1. Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      // Permission denied or dismissed
      // Save user preference as disabled in Firestore
      try {
        await updateDoc(doc(db, 'profiles', userId), {
          notificationEnabled: false,
          lastTokenUpdate: new Date().toISOString()
        });
      } catch (err) {
        console.error('Failed to save notification preference to Firestore profiles:', err);
      }
      return { success: false, error: 'Permission was ' + permission };
    }

    // 2. Fetch standard user-specific public VAPID key
    // We try to grab the environment variable value. If not configured, we can still generate without it or report guidance.
    const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || 'BFb_iUvBvCjBqZ7C0bW5qQ-gB8Z9eR3Xz6Y_R3Xz6Y_R3Xz6Y_eR3Xz6Y'; 

    // 3. Obtain registration token
    const token = await getToken(messaging, { 
      vapidKey: vapidKey 
    });

    if (token) {
      // 4. Store token per authenticated user in their Profile record
      await updateDoc(doc(db, 'profiles', userId), {
        fcmToken: token,
        notificationEnabled: true,
        lastTokenUpdate: new Date().toISOString()
      });
      return { success: true, token };
    } else {
      return { success: false, error: 'No FCM token returned from Google servers.' };
    }
  } catch (err: any) {
    console.error('Setup FCM token failure:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Listen to foreground messages (when the tab is in focus).
 * Displays a non-intrusive in-app banner or triggers localized alert events.
 */
export function onForegroundMessage(callback: (payload: any) => void) {
  if (!isFcmSupported() || !messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log('FCM Foreground message received:', payload);
    callback(payload);
  });
}
