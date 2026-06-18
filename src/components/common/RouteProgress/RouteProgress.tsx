import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './RouteProgress.module.scss';

export default function RouteProgress() {
  const location = useLocation();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const doneTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any in-flight timers
    if (doneTimer.current)  clearTimeout(doneTimer.current);
    if (idleTimer.current)  clearTimeout(idleTimer.current);

    // Start bar
    setPhase('running');

    // "Complete" it after 500 ms
    doneTimer.current = setTimeout(() => {
      setPhase('done');
      // Fade out then hide
      idleTimer.current = setTimeout(() => setPhase('idle'), 400);
    }, 500);

    return () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [location.pathname]);

  if (phase === 'idle') return null;

  return <div className={`${styles.bar} ${phase === 'done' ? styles.done : ''}`} />;
}
