import { useQuery } from "@tanstack/react-query";
import { getUserFriends } from "../lib/api";
import { Link } from "react-router";
import { UserPlusIcon, UsersIcon } from "lucide-react";
import FriendCard from "../components/FriendCard";

const HomePage = () => {
  const { data: friends = [], isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Your Friends</h2>
          <Link to="/friends" className="btn btn-primary btn-sm gap-2">
            <UserPlusIcon className="size-4" />
            Add Friend
          </Link>
        </div>

        {/* Friends grid */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : friends.length === 0 ? (
          <div className="card bg-base-200 p-10 text-center">
            <UsersIcon className="size-12 mx-auto mb-4 text-base-content/30" />
            <h3 className="font-semibold text-lg mb-2">No friends yet</h3>
            <p className="text-base-content/60 mb-4">
              Add friends by their email address to start chatting!
            </p>
            <Link to="/friends" className="btn btn-primary btn-sm mx-auto gap-2">
              <UserPlusIcon className="size-4" />
              Add Your First Friend
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {friends.map((friend) => (
              <FriendCard key={friend._id} friend={friend} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default HomePage;
