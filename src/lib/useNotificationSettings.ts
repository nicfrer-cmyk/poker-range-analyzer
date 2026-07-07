"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from "@/lib/notifications";

/** Same read-on-mount / write-through pattern as useTheme.ts and useMockPlan.ts. */
export function useNotificationSettings(): [NotificationSettings, (s: NotificationSettings) => void] {
  const [settings, setSettingsState] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  useEffect(() => {
    setSettingsState(getNotificationSettings());
  }, []);

  const setSettings = (s: NotificationSettings) => {
    saveNotificationSettings(s);
    setSettingsState(s);
  };

  return [settings, setSettings];
}
