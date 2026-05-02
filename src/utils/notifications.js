import * as Notifications from 'expo-notifications';
import notificationsConfig from '../config/notifications.config';

export async function scheduleLocalNotification(id, title, body, triggerSeconds) {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body },
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
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body },
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
      content: { title: paydayReminder.title, body: paydayReminder.body },
      trigger: { type: 'date', date: dateVal },
    });
  } catch (e) {
    console.warn('schedulePaydayReminder error:', e);
  }
}

export async function requestNotificationPermissions() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
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
