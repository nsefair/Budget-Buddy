import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";
import { router } from "expo-router";

import { api, IS_MOCK } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import { secureLog } from "@/utils/security";

type NotificationsModule = typeof import("expo-notifications");
type ExpoNotification = import("expo-notifications").Notification;

let notificationsModule: NotificationsModule | null | undefined;

const COMMON_NOTIFICATION_NATIVE_MODULES = [
  "ExpoPushTokenManager",
  "NotificationsServerRegistrationModule",
  "ExpoNotificationPresenter",
  "ExpoBadgeModule",
  "ExpoNotificationScheduler",
  "ExpoNotificationCategoriesModule",
  "ExpoNotificationsEmitter",
  "ExpoNotificationsHandlerModule",
  "ExpoNotificationPermissionsModule",
  "ExpoBackgroundNotificationTasksModule",
] as const;

const ANDROID_NOTIFICATION_NATIVE_MODULES = [
  "ExpoNotificationChannelManager",
  "ExpoNotificationChannelGroupManager",
] as const;

function hasNotificationNativeModules(): boolean {
  if (Platform.OS === "web") return true;
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;

  const requiredModules =
    Platform.OS === "android"
      ? [...COMMON_NOTIFICATION_NATIVE_MODULES, ...ANDROID_NOTIFICATION_NATIVE_MODULES]
      : COMMON_NOTIFICATION_NATIVE_MODULES;

  return requiredModules.every(
    (moduleName) => requireOptionalNativeModule(moduleName) !== null
  );
}

function getNotifications(): NotificationsModule | null {
  if (notificationsModule !== undefined) return notificationsModule;

  if (!hasNotificationNativeModules()) {
    notificationsModule = null;
    return notificationsModule;
  }

  try {
    notificationsModule = require("expo-notifications") as NotificationsModule;
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // A development client built before expo-notifications was added will not
    // contain its native modules. Keep the rest of the app usable until rebuilt.
    notificationsModule = null;
  }

  return notificationsModule;
}

export interface NotificationPreferences {
  streakEnabled: boolean;
  questsEnabled: boolean;
  weeklyEnabled: boolean;
  budsEnabled: boolean;
  billsEnabled: boolean;
  smartEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  timezone: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  streakEnabled: true,
  questsEnabled: true,
  weeklyEnabled: true,
  budsEnabled: true,
  billsEnabled: true,
  smartEnabled: false,
  pushEnabled: true,
  emailEnabled: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
  quietHoursStart: null,
  quietHoursEnd: null,
};

export function useNotificationObserver() {
  useEffect(() => {
    const Notifications = getNotifications();
    if (!Notifications) return;

    const openNotification = (notification: ExpoNotification) => {
      const url = notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) {
        router.push(url as never);
      }
    };

    const initial = Notifications.getLastNotificationResponse();
    if (initial?.notification) openNotification(initial.notification);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotification(response.notification);
    });
    return () => subscription.remove();
  }, []);
}

export const notificationService = {
  getPreferences: async () => {
    if (IS_MOCK) return DEFAULT_NOTIFICATION_PREFERENCES;
    return api.get<NotificationPreferences>(ENDPOINTS.NOTIFICATIONS.PREFERENCES);
  },

  updatePreferences: async (preferences: NotificationPreferences) => {
    if (IS_MOCK) return preferences;
    return api.put<NotificationPreferences>(ENDPOINTS.NOTIFICATIONS.PREFERENCES, preferences);
  },

  list: async (limit = 30) => {
    if (IS_MOCK) return { notifications: [] as AppNotification[], unreadCount: 0 };
    return api.get<{ notifications: AppNotification[]; unreadCount: number }>(
      ENDPOINTS.NOTIFICATIONS.LIST,
      { limit }
    );
  },

  markRead: async (id: string) => {
    if (!IS_MOCK) await api.post(ENDPOINTS.NOTIFICATIONS.READ(id));
  },

  markAllRead: async () => {
    if (!IS_MOCK) await api.post(ENDPOINTS.NOTIFICATIONS.READ_ALL);
  },

  registerForPush: async () => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      return { registered: false, reason: "unsupported_platform" as const };
    }
    const Notifications = getNotifications();
    if (!Notifications) {
      return { registered: false, reason: "native_module_unavailable" as const };
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Budget Buddy",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    const permission =
      existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") {
      return { registered: false, reason: "permission_denied" as const };
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      return { registered: false, reason: "project_not_configured" as const };
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!IS_MOCK) {
      await api.post(ENDPOINTS.NOTIFICATIONS.DEVICES, {
        provider: "expo",
        token,
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version ?? "",
      });
    }
    return { registered: true, token };
  },

  createLocalTest: async () => {
    const Notifications = getNotifications();
    if (!Notifications) {
      return { sent: false, reason: "native_module_unavailable" as const };
    }
    const existing = await Notifications.getPermissionsAsync();
    const permission =
      existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") {
      return { sent: false, reason: "permission_denied" as const };
    }
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Budget Buddy test",
        body: "Your notification preferences are connected.",
        data: { url: "/settings/notifications" },
      },
      trigger: null,
    });
    if (!IS_MOCK) {
      void api.post(ENDPOINTS.NOTIFICATIONS.TEST, {
        title: "Budget Buddy test",
        body: "Your notification preferences are connected.",
      })
        .catch((error) => secureLog.warn("notifications.localTest backend sync failed", error));
    }

    let delivered = false;
    for (let attempt = 0; attempt < 8 && !delivered; attempt += 1) {
      const presented = await Notifications.getPresentedNotificationsAsync();
      delivered = presented.some(
        (notification) => notification.request.identifier === notificationId
      );
      if (!delivered) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    return { sent: true as const, delivered, notificationId };
  },
};
