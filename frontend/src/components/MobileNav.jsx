import { Link, useLocation } from "react-router";
import { BellIcon, HomeIcon, UsersIcon, UserIcon } from "lucide-react";
import useNotificationCount from "../hooks/useNotificationCount";

/**
 * Bottom navigation bar — only visible on mobile (< lg breakpoint).
 * Mirrors the Sidebar nav links.
 */
const MobileNav = () => {
  const { pathname } = useLocation();
  const notifCount = useNotificationCount();

  const links = [
    { to: "/", icon: HomeIcon, label: "Home" },
    { to: "/friends", icon: UsersIcon, label: "Friends" },
    {
      to: "/notifications",
      icon: BellIcon,
      label: "Alerts",
      badge: notifCount,
    },
    { to: "/profile", icon: UserIcon, label: "Profile" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-base-200 border-t border-base-300 flex items-center justify-around h-16 safe-area-inset-bottom">
      {links.map(({ to, icon: Icon, label, badge }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              active ? "text-primary" : "text-base-content/60 hover:text-base-content"
            }`}
          >
            <div className="relative">
              <Icon className="size-5" />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-error text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default MobileNav;
