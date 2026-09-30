import { useEffect, useState } from 'react';

/**
 * Hook to enforce anti-screenshot and content protection deterrents
 * during exam taking and PDF viewing.
 */
export function useAntiScreenshot(enabled = true) {
  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    // 1. Block right click
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // 2. Block shortcut keys
    const handleKeyDown = (e) => {
      // PrintScreen
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        try {
          navigator.clipboard.writeText('');
        } catch (err) {}
        setBlurred(true);
        setTimeout(() => setBlurred(false), 2000);
        return false;
      }

      // Ctrl/Cmd + P (Print), Ctrl/Cmd + S (Save), Ctrl+Shift+I / F12 (DevTools)
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S' || e.key === 'c' || e.key === 'C')
      ) {
        e.preventDefault();
        return false;
      }

      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j'))
      ) {
        e.preventDefault();
        return false;
      }
    };

    // 3. Tab switch / Window blur protection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setBlurred(true);
      } else {
        setBlurred(false);
      }
    };

    const handleBlur = () => {
      setBlurred(true);
    };

    const handleFocus = () => {
      setBlurred(false);
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled]);

  return { blurred, setBlurred };
}
