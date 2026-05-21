import { Link } from "react-router";

const FriendCard = ({ friend }) => {
  return (
    <div className="card bg-base-200 hover:shadow-md transition-shadow">
      <div className="card-body p-4">
        {/* USER INFO */}
        <div className="flex items-center gap-3 mb-4">
          <div className="avatar size-12 rounded-full overflow-hidden flex-shrink-0">
            <img
              src={friend.profilePic}
              alt={friend.fullName}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%234b5563'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%239ca3af'/%3E%3Cellipse cx='50' cy='90' rx='30' ry='22' fill='%239ca3af'/%3E%3C/svg%3E";
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

        <Link to={`/chat/${friend._id}`} className="btn btn-outline w-full btn-sm">
          Message
        </Link>
      </div>
    </div>
  );
};

export default FriendCard;
