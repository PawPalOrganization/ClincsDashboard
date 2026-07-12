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

    // Start bar — synchronous by design: this is a route-change progress-bar
    // animation, not data synchronization, and deferring it would add a visible
    // frame of delay before the bar appears.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
