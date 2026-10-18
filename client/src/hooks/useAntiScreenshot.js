import { useEffect, useState } from 'react';

/**
 * Hook to enforce anti-screenshot and content protection deterrents
 * during exam taking and PDF viewing.
 */
export function useAntiScreenshot(enabled = true) {
  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let blurTimeout = null;

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
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('');
          }
        } catch (err) {}
        setBlurred(true);
        setTimeout(() => setBlurred(false), 2000);
        return false;
      }

      // Ctrl/Cmd + P (Print), Ctrl/Cmd + S (Save)
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

    // 3. Tab switch protection (authoritative)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setBlurred(true);
      } else {
        if (blurTimeout) clearTimeout(blurTimeout);
        setBlurred(false);
      }
    };

    // 4. Tolerant Window Blur (ignores micro-blurs like iframes, selects, and autocompletes)
    const handleBlur = () => {
      // If user clicked inside an internal frame or form element, do not trigger anti-cheat blur
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'iframe' || activeTag === 'select' || activeTag === 'input' || activeTag === 'textarea') {
        return;
      }

      // Give 1.2s debounce to verify if window is actually unfocused
      if (blurTimeout) clearTimeout(blurTimeout);
      blurTimeout = setTimeout(() => {
        if (document.hidden || !document.hasFocus()) {
          setBlurred(true);
        }
      }, 1200);
    };

    const handleFocus = () => {
      if (blurTimeout) clearTimeout(blurTimeout);
      setBlurred(false);
    };

    const handleClick = () => {
      if (blurTimeout) clearTimeout(blurTimeout);
      if (!document.hidden && blurred) {
        setBlurred(false);
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('click', handleClick);

    return () => {
      if (blurTimeout) clearTimeout(blurTimeout);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('click', handleClick);
    };
  }, [enabled, blurred]);

  return { blurred, setBlurred, resume: () => setBlurred(false) };
}
