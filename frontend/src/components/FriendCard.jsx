import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeFriend } from "../lib/api";
import toast from "react-hot-toast";
import { MessageCircleIcon, UserMinusIcon } from "lucide-react";

const FALLBACK_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%234b5563'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%239ca3af'/%3E%3Cellipse cx='50' cy='90' rx='30' ry='22' fill='%239ca3af'/%3E%3C/svg%3E";

const FriendCard = ({ friend }) => {
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);

  const { mutate: doRemove, isPending: isRemoving } = useMutation({
    mutationFn: removeFriend,
    onSuccess: () => {
      toast.success(`${friend.fullName} removed from friends`);
      setShowConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: () => {
      toast.error("Failed to remove friend");
    },
  });

  return (
    <>
      <div className="card bg-base-200 hover:shadow-md transition-shadow">
        <div className="card-body p-4">
          {/* Avatar + Name */}
          <div className="flex items-center gap-3 mb-4">
            <div className="avatar size-12 rounded-full overflow-hidden flex-shrink-0">
              <img
                src={friend.profilePic || FALLBACK_AVATAR}
                alt={friend.fullName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = FALLBACK_AVATAR;
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{friend.fullName}</h3>
              {friend.location && (
                <p className="text-xs text-base-content/50 truncate">{friend.location}</p>
              )}
            </div>
          </div>

          {friend.bio && (
            <p className="text-sm text-base-content/60 line-clamp-2 mb-3">{friend.bio}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Link
              to={`/chat/${friend._id}`}
              className="btn btn-outline flex-1 btn-sm gap-1"
            >
              <MessageCircleIcon className="size-4" />
              Message
            </Link>

            <button
              className="btn btn-error btn-sm btn-outline gap-1 px-3"
              onClick={() => setShowConfirm(true)}
              title="Remove friend"
            >
              <UserMinusIcon className="size-4" />
              Remove
            </button>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card bg-base-100 shadow-2xl w-full max-w-sm mx-4">
            <div className="card-body text-center gap-4">
              <div className="mx-auto size-14 rounded-full bg-error/10 flex items-center justify-center">
                <UserMinusIcon className="size-7 text-error" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Remove Friend?</h3>
                <p className="text-base-content/60 text-sm mt-1">
                  Remove{" "}
                  <span className="font-semibold text-base-content">
                    {friend.fullName}
                  </span>{" "}
                  from your friends list?
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  className="btn btn-ghost flex-1"
                  onClick={() => setShowConfirm(false)}
                  disabled={isRemoving}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-error flex-1 gap-2"
                  onClick={() => doRemove(friend._id)}
                  disabled={isRemoving}
                >
                  {isRemoving ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <UserMinusIcon className="size-4" />
                  )}
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FriendCard;
