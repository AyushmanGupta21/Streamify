import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserFriends, sendFriendRequestByEmail } from "../lib/api";
import toast from "react-hot-toast";
import FriendCard from "../components/FriendCard";
import { Link } from "react-router";
import {
  BellIcon,
  LoaderIcon,
  MailIcon,
  SearchIcon,
  SendIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";

const FriendsPage = () => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: friends = [], isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const { mutate: sendRequestMutation, isPending } = useMutation({
    mutationFn: sendFriendRequestByEmail,
    onSuccess: (data) => {
      toast.success(`Friend request sent to ${data.recipientName}!`);
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send friend request");
    },
  });

  const handleSendRequest = (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }
    sendRequestMutation(trimmed);
  };

  const filteredFriends = friends.filter((f) =>
    f.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-5xl space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <UsersIcon className="size-8 text-primary" />
              Friends
            </h1>
            <p className="text-base-content/60 mt-1">
              Manage your friends and send new friend requests
            </p>
          </div>
          <Link to="/notifications" className="btn btn-outline btn-sm gap-2">
            <BellIcon className="size-4" />
            View Requests
          </Link>
        </div>

        {/* ── Add Friend by Email Card ── */}
        <div className="card bg-base-200 shadow-md">
          <div className="card-body">
            <h2 className="card-title text-lg flex items-center gap-2">
              <UserPlusIcon className="size-5 text-primary" />
              Add a Friend
            </h2>
            <p className="text-sm text-base-content/60 mb-2">
              Enter your friend's email address to send them a friend request.
            </p>

            <form onSubmit={handleSendRequest} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter their email address..."
                  className="input input-bordered w-full pl-10"
                  disabled={isPending}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary gap-2 sm:w-auto w-full"
                disabled={isPending || !email.trim()}
              >
                {isPending ? (
                  <><LoaderIcon className="size-4 animate-spin" />Sending…</>
                ) : (
                  <><SendIcon className="size-4" />Send Request</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ── Friends List ── */}
        <div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
            <h2 className="text-xl font-semibold">
              Your Friends
              {friends.length > 0 && (
                <span className="badge badge-primary ml-2">{friends.length}</span>
              )}
            </h2>

            {/* Search */}
            {friends.length > 0 && (
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search friends…"
                  className="input input-bordered input-sm pl-9 w-48"
                />
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="card bg-base-200 p-10 text-center">
              {searchQuery ? (
                <>
                  <SearchIcon className="size-10 mx-auto mb-3 text-base-content/30" />
                  <h3 className="font-semibold text-lg mb-1">No results for "{searchQuery}"</h3>
                  <p className="text-base-content/50 text-sm">Try a different name</p>
                </>
              ) : (
                <>
                  <UsersIcon className="size-10 mx-auto mb-3 text-base-content/30" />
                  <h3 className="font-semibold text-lg mb-1">No friends yet</h3>
                  <p className="text-base-content/50 text-sm">
                    Send a friend request above to get started!
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredFriends.map((friend) => (
                <FriendCard key={friend._id} friend={friend} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default FriendsPage;
