import * as Notifications from 'expo-notifications';

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
