import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUESTS_KEYS, questsService } from "@/services/questsService";
import { useAuthStore } from "@/stores/authStore";
import type { QuestDashboard } from "@/features/quests/types";

export function useQuestDashboard() {
  const queryClient = useQueryClient();
  const dashboardQuery = useQuery(questsService.queries.dashboard());

  const checkInMutation = useMutation({
    mutationFn: questsService.checkIn,
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
