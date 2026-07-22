import { useQuery } from '@tanstack/react-query';
import { statsService } from '../../../services/statsService';

export function useStats() {
    const statsQuery = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: statsService.getUserStats,
        refetchInterval: 30000, // Refetch every 30 seconds
    });

    return {
        stats: statsQuery.data,
        isLoading: statsQuery.isLoading,
        isError: statsQuery.isError,
        error: statsQuery.error,
        refetch: () => statsQuery.refetch(),
    };
}
