import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUserFriends,
  lookupUserByEmail,
  sendFriendRequestByEmail,
} from "../lib/api";
import toast from "react-hot-toast";
import FriendCard from "../components/FriendCard";
import { Link } from "react-router";
import {
  BellIcon,
  CheckCircleIcon,
  LoaderIcon,
  MailIcon,
  SearchIcon,
  SendIcon,
  UserPlusIcon,
  UsersIcon,
  XCircleIcon,
} from "lucide-react";

const FALLBACK_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%234b5563'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%239ca3af'/%3E%3Cellipse cx='50' cy='90' rx='30' ry='22' fill='%239ca3af'/%3E%3C/svg%3E";

const FriendsPage = () => {
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const debounceRef = useRef(null);
  const dropdownRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: friends = [], isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const { mutate: sendRequestMutation, isPending: isSending } = useMutation({
    mutationFn: sendFriendRequestByEmail,
    onSuccess: (data) => {
      toast.success(`Friend request sent to ${data.recipientName}!`);
      setEmail("");
      setLookupResult(null);
      setShowDropdown(false);
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send friend request");
    },
  });

  // Debounced email lookup
  useEffect(() => {
    const trimmed = email.trim();

    if (!trimmed || trimmed.length < 3) {
      setLookupResult(null);
      setShowDropdown(false);
      return;
    }

    setLookupResult("loading");
    setShowDropdown(true);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setLookupResult("partial");
        return;
      }
      try {
        const data = await lookupUserByEmail(trimmed);
        setLookupResult(data.user ? data.user : "not_found");
      } catch {
        setLookupResult("not_found");
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [email]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSendRequest = (e) => {
    e?.preventDefault();
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

  const renderDropdown = () => {
    if (!showDropdown) return null;

    let content;
    if (lookupResult === "loading") {
      content = (
        <div className="flex items-center gap-3 px-4 py-3 text-base-content/60">
          <LoaderIcon className="size-4 animate-spin" />
          <span className="text-sm">Looking up…</span>
        </div>
      );
    } else if (lookupResult === "partial") {
      content = (
        <div className="px-4 py-3 text-sm text-base-content/50">
          Keep typing to complete the email…
        </div>
      );
    } else if (lookupResult === "not_found") {
      content = (
        <div className="flex items-center gap-3 px-4 py-3 text-error">
          <XCircleIcon className="size-4" />
          <span className="text-sm">No user found with this email</span>
        </div>
      );
    } else if (lookupResult && typeof lookupResult === "object") {
      const isAlreadyFriend = friends.some((f) => f._id === lookupResult._id);
      content = (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="avatar size-9 rounded-full overflow-hidden flex-shrink-0">
              <img
                src={lookupResult.profilePic || FALLBACK_AVATAR}
                alt={lookupResult.fullName}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_AVATAR; }}
              />
            </div>
            <div>
              <p className="font-semibold text-sm">{lookupResult.fullName}</p>
              <p className="text-xs text-base-content/50">{lookupResult.email}</p>
            </div>
          </div>
          {isAlreadyFriend ? (
            <span className="badge badge-success gap-1 text-xs">
              <CheckCircleIcon className="size-3" /> Already friends
            </span>
          ) : (
            <button
              onClick={handleSendRequest}
              disabled={isSending}
              className="btn btn-primary btn-xs gap-1"
            >
              {isSending
                ? <LoaderIcon className="size-3 animate-spin" />
                : <SendIcon className="size-3" />}
              Send
            </button>
          )}
        </div>
      );
    } else {
      return null;
    }

    return (
      <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-base-100 border border-base-300 rounded-xl shadow-xl overflow-hidden">
        {content}
      </div>
    );
  };

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

        {/* Add Friend Card */}
        <div className="card bg-base-200 shadow-md">
          <div className="card-body">
            <h2 className="card-title text-lg flex items-center gap-2">
              <UserPlusIcon className="size-5 text-primary" />
              Add a Friend
            </h2>
            <p className="text-sm text-base-content/60 mb-3">
              Enter your friend's email address — we'll look them up instantly.
            </p>

            <form onSubmit={handleSendRequest} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1" ref={dropdownRef}>
                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40 z-10" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setShowDropdown(true); }}
                  onFocus={() => email.trim().length >= 3 && setShowDropdown(true)}
                  placeholder="Enter their email address..."
                  className="input input-bordered w-full pl-10"
                  disabled={isSending}
                  autoComplete="off"
                />
                {renderDropdown()}
              </div>

              <button
                type="submit"
                className="btn btn-primary gap-2 sm:w-auto w-full"
                disabled={isSending || !email.trim()}
              >
                {isSending
                  ? <><LoaderIcon className="size-4 animate-spin" />Sending…</>
                  : <><SendIcon className="size-4" />Send Request</>}
              </button>
            </form>
          </div>
        </div>

        {/* Friends List */}
        <div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
            <h2 className="text-xl font-semibold">
              Your Friends
              {friends.length > 0 && (
                <span className="badge badge-primary ml-2">{friends.length}</span>
              )}
            </h2>

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
