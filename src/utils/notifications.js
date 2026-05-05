import * as Notifications from 'expo-notifications';
import notificationsConfig from '../config/notifications.config';

export const QUICK_LOG_NOTIFICATION_ACTION = 'NOVA_QUICK_LOG_ACTION';
export const QUICK_LOG_NOTIFICATION_CATEGORY = 'nova_quick_log';
export const QUICK_LOG_NOTIFICATION_URL = 'nova://record-transaction?source=notification_action';

export async function configureNotificationActions() {
  try {
    await Notifications.setNotificationCategoryAsync(QUICK_LOG_NOTIFICATION_CATEGORY, [
      {
        identifier: QUICK_LOG_NOTIFICATION_ACTION,
        buttonTitle: 'Log expense',
        options: {
          opensAppToForeground: true,
        },
      },
    ]);
  } catch (e) {
    console.warn('configureNotificationActions error:', e);
  }
}

function contentWithQuickLogAction(content = {}) {
  return {
    ...content,
    categoryIdentifier: QUICK_LOG_NOTIFICATION_CATEGORY,
    data: {
      ...(content.data || {}),
      quickLogUrl: QUICK_LOG_NOTIFICATION_URL,
    },
  };
}

export function addQuickLogNotificationResponseListener(handler) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    if (response?.actionIdentifier !== QUICK_LOG_NOTIFICATION_ACTION) return;
    const data = response.notification?.request?.content?.data || {};
    handler?.(data.quickLogUrl || QUICK_LOG_NOTIFICATION_URL);
  });
}

export async function getLastQuickLogNotificationUrl() {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response?.actionIdentifier !== QUICK_LOG_NOTIFICATION_ACTION) return null;
    const data = response.notification?.request?.content?.data || {};
    Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
    return data.quickLogUrl || QUICK_LOG_NOTIFICATION_URL;
  } catch {
    return null;
  }
}

export async function scheduleLocalNotification(id, title, body, triggerSeconds) {
  try {
    await configureNotificationActions();
    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: contentWithQuickLogAction({ title, body }),
      trigger: { type: 'timeInterval', seconds: Math.max(1, triggerSeconds), repeats: false },
    });
    return identifier;
  } catch (e) {
    console.warn('scheduleLocalNotification error:', e);
    return null;
  }
}

export async function scheduleCalendarNotification(id, title, body, trigger) {
  try {
    await configureNotificationActions();
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: contentWithQuickLogAction({ title, body }),
      trigger,
    });
    return identifier;
  } catch (e) {
    console.warn('scheduleCalendarNotification error:', e);
    return null;
  }
}

export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('cancelAllNotifications error:', e);
  }
}

export async function cancelNotification(id) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (e) {
    console.warn('cancelNotification error:', e);
  }
}

export async function schedulePaydayReminder(nextPaycheckDate) {
  const PAYDAY_NOTIF_ID = 'nova_payday_reminder';
  try {
    await configureNotificationActions();
    await Notifications.cancelScheduledNotificationAsync(PAYDAY_NOTIF_ID).catch(() => {});
    if (!nextPaycheckDate) return;
    const dateVal = typeof nextPaycheckDate === 'string'
      ? (() => { const [y, mo, d] = nextPaycheckDate.split('-').map(Number); return new Date(y, mo - 1, d); })()
      : new Date(nextPaycheckDate);
    dateVal.setHours(9, 0, 0, 0);
    if (dateVal.getTime() <= Date.now()) return;
    const { paydayReminder } = notificationsConfig;
    await Notifications.scheduleNotificationAsync({
      identifier: PAYDAY_NOTIF_ID,
      content: contentWithQuickLogAction({ title: paydayReminder.title, body: paydayReminder.body }),
      trigger: { type: 'date', date: dateVal },
    });
  } catch (e) {
    console.warn('schedulePaydayReminder error:', e);
  }
}

export async function requestNotificationPermissions() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') await configureNotificationActions();
    return status === 'granted';
  } catch (e) {
    console.warn('requestNotificationPermissions error:', e);
    return false;
  }
}

export async function getScheduledNotifications() {
  try {
    return await Notifications.getAllScheduledNotificationsAsync() || [];
  } catch (e) {
    console.warn('getScheduledNotifications error:', e);
    return [];
  }
}
