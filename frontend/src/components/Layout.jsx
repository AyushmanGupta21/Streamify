import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import MobileNav from "./MobileNav";

const Layout = ({ children, showSidebar = false }) => {
  return (
    <div className="min-h-screen">
      <div className="flex">
        {showSidebar && <Sidebar />}

        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />

          {/* pb-20 on mobile leaves room for the fixed bottom nav */}
          <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation — hidden on desktop */}
      <MobileNav />
    </div>
  );
};

export default Layout;
