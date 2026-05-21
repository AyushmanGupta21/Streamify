import { Link, useLocation } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { BellIcon, LogOutIcon, ShipWheelIcon, UserIcon } from "lucide-react";
import ThemeSelector from "./ThemeSelector";
import useLogout from "../hooks/useLogout";
import useNotificationCount from "../hooks/useNotificationCount";

const Navbar = () => {
  const { authUser } = useAuthUser();
  const location = useLocation();
  const isChatPage = location.pathname?.startsWith("/chat");

  const { logoutMutation, isPending } = useLogout();
  const notifCount = useNotificationCount();

  return (
    <nav className="bg-base-200 border-b border-base-300 sticky top-0 z-30 h-16 flex items-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-end w-full">
          {/* LOGO - ONLY IN THE CHAT PAGE */}
          {isChatPage && (
            <div className="pl-5">
              <Link to="/" className="flex items-center gap-2.5">
                <ShipWheelIcon className="size-9 text-primary" />
                <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
                  Streamify
                </span>
              </Link>
            </div>
          )}

          <div className="flex items-center gap-3 sm:gap-4 ml-auto">
            {/* Notifications bell — hidden on mobile (MobileNav handles it) */}
            <Link to="/notifications" className="hidden lg:block">
              <div className="indicator">
                {notifCount > 0 && (
                  <span className="indicator-item badge badge-error badge-sm text-white font-bold min-w-[1.1rem] h-[1.1rem] text-[10px]">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
                <button className="btn btn-ghost btn-circle" title="Notifications">
                  <BellIcon className="h-6 w-6 text-base-content opacity-70" />
                </button>
              </div>
            </Link>
          </div>

          {/* Theme Selector */}
          <ThemeSelector />

          {/* Avatar — links to profile */}
          <Link to="/profile" className="tooltip tooltip-bottom" data-tip="My Profile">
            <div className="avatar cursor-pointer hover:ring-2 hover:ring-primary rounded-full transition-all ml-2">
              <div className="w-9 rounded-full">
                {authUser?.profilePic ? (
                  <img src={authUser.profilePic} alt="User Avatar" />
                ) : (
                  <div className="bg-base-300 flex items-center justify-center h-full w-full rounded-full">
                    <UserIcon className="size-5 text-base-content/60" />
                  </div>
                )}
              </div>
            </div>
          </Link>

          {/* Logout button */}
          <button
            className="btn btn-ghost btn-circle ml-1"
            onClick={() => logoutMutation()}
            disabled={isPending}
            title="Logout"
          >
            {isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <LogOutIcon className="h-6 w-6 text-base-content opacity-70" />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
};
export default Navbar;
