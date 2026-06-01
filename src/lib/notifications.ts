import { supabase } from "@/integrations/supabase/client";

// VAPID public key - stored in env for edge function, hardcoded here for subscription
const VAPID_PUBLIC_KEY = 'BHjLSimQ3un8DT14drldihXB3vX5lQZF_gOtxd2hL794xW4Bp3VgPhaaQrTCsqXX8zriwvJuxpx8FPUDsSqYq5Q';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("Ce navigateur ne supporte pas les notifications.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function sendLocalNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === "granted") {
    new Notification(title, {
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      ...options,
    });
  }
}

/**
 * Subscribe to Web Push notifications and store the subscription in Supabase.
 * Returns true if subscription was successful.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging is not supported');
      return false;
    }

    const permission = await requestNotificationPermission();
    if (!permission) return false;

    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint!;
    const p256dh = subJson.keys!.p256dh!;
    const auth = subJson.keys!.auth!;

    // Upsert subscription in database
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint,
          p256dh,
          auth_key: auth,
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      console.error('Failed to save push subscription:', error);
      return false;
    }

    console.log('[Push] Subscription saved successfully');
    return true;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return false;
  }
}

/**
 * Send a push notification to a specific user via the edge function.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  link?: string,
  tag?: string
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-push', {
      body: { userId, title, body, link, tag },
    });
    if (error) console.error('Failed to send push:', error);
  } catch (err) {
    console.error('Send push error:', err);
  }
}
