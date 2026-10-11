import { api, IS_MOCK } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import { secureLog } from "@/utils/security";

// The five interactions the beta measures (see the launch guide).
export type BetaEvent = "app_open" | "number_tap" | "goal_move_tap" | "score_tap" | "number_report";

export const eventsService = {
  // Fire and forget: a failed log must never block, slow, or interrupt the
  // screen (debug level, so a dev build shows no warning toast).
  log: (kind: BetaEvent, detail?: Record<string, string | number | boolean>) => {
    if (IS_MOCK) return;
    api.post(ENDPOINTS.EVENTS, { kind, detail }).catch((error) => secureLog.debug("events.log failed", error));
  },
};
