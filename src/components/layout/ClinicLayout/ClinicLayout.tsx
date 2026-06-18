import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ClinicSidebar from '../ClinicSidebar/ClinicSidebar';
import RouteProgress from '../../common/RouteProgress/RouteProgress';
import styles from './ClinicLayout.module.scss';

export default function ClinicLayout() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1200);

  useEffect(() => {
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth > 1200);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const closeSidebar  = () => setIsSidebarOpen(false);

  return (
    <div className={styles.layout}>
      <RouteProgress />

      {/* Hamburger — animates out when sidebar is open */}
      <button
        className={`${styles.hamburger} ${
          isSidebarOpen ? styles.hamburgerHidden : styles.hamburgerVisible
        }`}
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <i className="bi bi-list" />
      </button>

      {/* Mobile overlay — tap to close sidebar */}
      {isSidebarOpen && (
        <div className={styles.overlay} onClick={closeSidebar} />
      )}

      <ClinicSidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

      <main
        className={`${styles.mainContent} ${
          !isSidebarOpen ? styles.sidebarClosed : ''
        }`}
      >
        <div key={location.pathname} className={styles.contentWrapper}>
          <Outlet />
        </div>
      </main>

    </div>
  );
}
