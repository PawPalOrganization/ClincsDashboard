import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../../context/ClinicAuthContext';
import { hasClinicPermission } from '../../../utils/clinicPermissions';
import type { ClinicPermissionSlug } from '../../../utils/clinicPermissions';
import clinicProfileService from '../../../services/clinic/clinicProfileService';
import type { Clinic } from '../../../types/clinic.types';
import styles from './ClinicSidebar.module.scss';

interface ClinicSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  path: string;
  icon: string;
  label: string;
  permission?: ClinicPermissionSlug;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', icon: 'bi-grid',     label: 'Dashboard' },
  { path: '/branches',  icon: 'bi-building', label: 'Branches',  permission: 'clinic-branches.read' },
  { path: '/staff',     icon: 'bi-people',   label: 'Staff',     permission: 'clinic-staff.read'    },
  { path: '/settings',  icon: 'bi-gear',     label: 'Settings',  permission: 'clinics.read'         },
];

export default function ClinicSidebar({ isOpen, onClose }: ClinicSidebarProps) {
  const { staff, clinicId, logout } = useClinicAuth();
  const [clinic, setClinic] = useState<Clinic | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    clinicProfileService.get(clinicId).then(setClinic).catch(() => {});
  }, [clinicId]);

  useEffect(() => {
    document.title = clinic?.title ? `${clinic.title} | PawPal` : 'PawPal Clinics';
    return () => { document.title = 'PawPal Clinics'; };
  }, [clinic?.title]);

  useEffect(() => {
    const link = (document.querySelector("link[rel~='icon']") as HTMLLinkElement)
      ?? Object.assign(document.createElement('link'), { rel: 'icon' });
    if (!link.parentNode) document.head.appendChild(link);
    link.href = clinic?.logoUrl ?? '/favicon.ico';
    return () => { link.href = '/favicon.ico'; };
  }, [clinic?.logoUrl]);

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.permission || hasClinicPermission(staff, item.permission),
  );
  const navigate = useNavigate();

  const staffName =
    [staff?.firstName, staff?.lastName].filter(Boolean).join(' ') || 'Staff';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleNavClick = () => {
    if (window.innerWidth <= 768) onClose();
  };

  return (
    <div className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>

      {/* Close button */}
      <button
        className={styles.closeButton}
        onClick={onClose}
        aria-label="Close sidebar"
      >
        <i className="bi bi-x" />
      </button>

      {/* Logo */}
      <div className={styles.logo}>
        {clinic?.logoUrl
          ? <img src={clinic.logoUrl} alt={clinic.title} className={styles.logoImg} />
          : <i className="bi bi-heart-pulse" />
        }
        <span>{clinic?.title ?? 'PawPal Clinics'}</span>
      </div>

      {/* Main navigation */}
      <nav className={styles.nav}>
        <ul className={styles.navList}>
          {visibleNavItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.active : ''}`
                }
                onClick={handleNavClick}
              >
                <i className={`bi ${item.icon} ${styles.navIcon}`} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>


      
      {/* Bottom: profile card + logout */}
      <div className={styles.bottomSection}>
        <div className={styles.profileCard}>
          <div className={styles.avatar}>
            <i className="bi bi-person-circle" />
          </div>
          <div className={styles.profileText}>
            <div className={styles.greeting}>Logged in as</div>
            <div className={styles.staffName}>{staffName}</div>
          </div>
        </div>

        <button className={styles.logoutButton} onClick={handleLogout}>
          <i className="bi bi-box-arrow-right" />
          <span>Log out</span>
        </button>
      </div>

    </div>
  );
}
