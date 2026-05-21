import { useQuery } from "@tanstack/react-query";
import { getFriendRequests } from "../lib/api";

/**
 * Returns the number of pending incoming friend requests.
 * Refreshes every 30 seconds so users see new requests without a page reload.
 */
const useNotificationCount = () => {
  const { data } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
    refetchInterval: 30_000, // poll every 30 s
    staleTime: 10_000,
  });

  const count = data?.incomingReqs?.length ?? 0;
  return count;
};

export default useNotificationCount;
