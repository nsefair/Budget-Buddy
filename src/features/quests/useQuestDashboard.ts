import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { IS_MOCK } from "@/api/client";
import { QUESTS_KEYS, questsService } from "@/services/questsService";
import { plaidService } from "@/services/plaidService";
import { useAuthStore } from "@/stores/authStore";
import { isBankVerified, type QuestDashboard } from "@/features/quests/types";

/**
 * Human-readable message from a failed check-in. Bank-verified quests are
 * rejected by the backend when the synced transactions contradict the quest
 * (e.g. a food purchase on a no-dining-out day) — surface that reason.
 */
export function questCheckInMessage(error: unknown) {
  const responseMessage = (
    error as {
      response?: { data?: { error?: { message?: unknown } } };
    }
  )?.response?.data?.error?.message;
  return typeof responseMessage === "string"
    ? responseMessage
    : "The activity is not visible in your synced Budget data yet. Refresh and try again.";
}

export function useQuestDashboard() {
  const queryClient = useQueryClient();
  const dashboardQuery = useQuery(questsService.queries.dashboard());

  const checkInMutation = useMutation({
    mutationFn: async (questId: string) => {
      // Bank-verified quests are judged against Plaid transactions, so pull a
      // fresh sync first. Failures fall through — the backend still enforces
      // data freshness and returns an actionable message.
      const quest = queryClient
        .getQueryData<QuestDashboard>(QUESTS_KEYS.dashboard())
        ?.quests.find((item) => item.id === questId);
      if (!IS_MOCK && quest && isBankVerified(quest.verificationType)) {
        await plaidService.sync().catch(() => undefined);
      }
      return questsService.checkIn(questId);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<QuestDashboard>(
        QUESTS_KEYS.dashboard(),
        (current) => {
          if (!current) return current;
          return {
            ...current,
            quests: current.quests.map((quest) =>
              quest.id === result.quest.id ? result.quest : quest
            ),
            score: result.score,
            league: {
              ...current.league,
              tier: result.score.leagueTier,
              users: current.league.users.map((user) =>
                user.isCurrentUser
                  ? {
                      ...user,
                      xp: result.totalXp,
                      financialScore: result.score.value,
                    }
                  : user
              ),
            },
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: QUESTS_KEYS.league() });
      useAuthStore.getState().updateUser({
        financialHealthScore: result.score.value,
        xp: result.totalXp,
      });
    },
  });

  return {
    ...dashboardQuery,
    checkIn: checkInMutation.mutateAsync,
    checkingIn: checkInMutation.isPending,
    checkingInQuestId: checkInMutation.variables,
    checkInError: checkInMutation.error,
  };
}
