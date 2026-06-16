import { NavLink } from 'react-router-dom';
import styles from './TabBar.module.scss';

interface Tab {
  label: string;
  to: string;
}

interface TabBarProps {
  tabs: Tab[];
}

export default function TabBar({ tabs }: TabBarProps) {
  return (
    <div className={styles.tabBar}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            `${styles.tab} ${isActive ? styles.tabActive : ''}`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
