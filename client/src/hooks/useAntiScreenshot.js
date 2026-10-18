import { useEffect, useState, useRef } from 'react';

/**
 * Hook to enforce anti-screenshot and content protection deterrents
 * during exam taking and PDF viewing.
 */
export function useAntiScreenshot(enabled = true, onViolation = null) {
  const [blurred, setBlurred] = useState(false);
  const lastViolationTimeRef = useRef(0);

  const reportViolation = (type, label) => {
    const now = Date.now();
    // 1500ms cooldown to prevent spamming identical violations
    if (now - lastViolationTimeRef.current > 1500) {
      lastViolationTimeRef.current = now;
      if (typeof onViolation === 'function') {
        onViolation({
          type,
          label,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    }
  };

  useEffect(() => {
    if (!enabled) return;

    // Clear clipboard helper
    const wipeClipboard = () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('').catch(() => {});
        }
      } catch (err) {}
    };

    // 1. Block right click
    const handleContextMenu = (e) => {
      e.preventDefault();
      reportViolation('contextmenu', 'Right Click / Context Menu Attempt');
      return false;
    };

    // 2. Intercept Snipping Tool & Screenshot Shortcuts (instant blur)
    const handleKeySecurity = (e) => {
      // PrintScreen (Key or keyCode 44)
      if (e.key === 'PrintScreen' || e.keyCode === 44 || e.key === 'Snapshot') {
        e.preventDefault();
        wipeClipboard();
        setBlurred(true);
        reportViolation('screenshot', 'Screenshot Attempt (PrintScreen Key)');
        return false;
      }

      // Windows Snipping Tool (Win + Shift + S) or Mac (Cmd + Shift + 3/4/5)
      if (
        (e.shiftKey && (e.metaKey || e.ctrlKey) && (e.key === 'S' || e.key === 's' || e.keyCode === 83)) ||
        (e.shiftKey && e.metaKey)
      ) {
        wipeClipboard();
        setBlurred(true);
        reportViolation('screenshot', 'Screen Capture Attempt (Snipping Tool / Shortcut)');
      }

      // Print (Ctrl/Cmd + P), Save (Ctrl/Cmd + S), Copy (Ctrl/Cmd + C)
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S' || e.key === 'c' || e.key === 'C')
      ) {
        e.preventDefault();
        reportViolation('copy_print', `Restricted Key Combination (${e.ctrlKey ? 'Ctrl' : 'Cmd'} + ${e.key.toUpperCase()})`);
        return false;
      }

      // DevTools (F12 or Ctrl+Shift+I/J/C)
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c'))
      ) {
        e.preventDefault();
        reportViolation('devtools', 'Developer Tools / Inspection Attempt');
        return false;
      }
    };

    // 3. Tab switch protection (authoritative)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        wipeClipboard();
        setBlurred(true);
        reportViolation('tab_switch', 'Tab Switch / Backgrounded Browser Tab');
      }
    };

    // 4. INSTANT Window Blur (Snipping Tool, Alt+Tab, OS Overlay — 0ms delay)
    const handleBlur = () => {
      wipeClipboard();
      setBlurred(true);
      reportViolation('window_defocus', 'Window Defocus / Desktop Overlay (Snipping Tool or Alt-Tab)');
    };

    // 5. Continuous heartbeat: detect OS-level overlays or lost focus
    const focusInterval = setInterval(() => {
      if (document.hidden || !document.hasFocus()) {
        wipeClipboard();
        setBlurred(true);
      }
    }, 120);

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeySecurity, true);
    window.addEventListener('keyup', handleKeySecurity, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      clearInterval(focusInterval);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeySecurity, true);
      window.removeEventListener('keyup', handleKeySecurity, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled]);

  return { blurred, setBlurred, resume: () => setBlurred(false) };
}
