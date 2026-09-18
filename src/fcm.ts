import { isSupported, getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { app, db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';

// Lazy messaging instance promise to avoid any top-level uncaught exceptions in unsupported browsers/iframes
let messagingPromise: Promise<Messaging | null> | null = null;

export async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  if (messagingPromise) return messagingPromise;

  messagingPromise = (async () => {
    try {
      const supported = await isSupported().catch(() => false);
      if (!supported) {
        console.info('Firebase Cloud Messaging is not supported or active in this frame.');
        return null;
      }
      return getMessaging(app);
    } catch (err) {
      console.warn('Firebase Cloud Messaging initialization skipped:', err);
      return null;
    }
  })();

  return messagingPromise;
}

export async function isFcmSupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    return await isSupported().catch(() => false);
  } catch {
    return false;
  }
}

/**
 * Request notification permissions and register FCM token.
 * Stores token per authenticated user in their Firestore profile.
 */
export async function setupFcmToken(userId: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      return { success: false, error: 'FCM is not supported in this browser environment.' };
    }

    // 1. Request notification permission
    if (typeof Notification === 'undefined' || typeof Notification.requestPermission !== 'function') {
      return { success: false, error: 'Notifications API not available in this browser.' };
    }

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

    // 2. Fetch standard public VAPID key from environment variable
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
export function onForegroundMessage(callback: (payload: any) => void): () => void {
  let unsub: (() => void) | null = null;
  let active = true;

  getMessagingInstance().then((messaging) => {
    if (!active || !messaging) return;
    try {
      unsub = onMessage(messaging, (payload) => {
        console.log('FCM Foreground message received:', payload);
        callback(payload);
      });
    } catch (err) {
      console.debug('onForegroundMessage registration error:', err);
    }
  }).catch((err) => {
    console.debug('FCM instance error:', err);
  });

  return () => {
    active = false;
    if (typeof unsub === 'function') {
      try {
        unsub();
      } catch {}
    }
  };
}
