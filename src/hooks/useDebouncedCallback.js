import { useRef, useCallback, useEffect } from 'react';

/**
 * Returns a debounced version of the callback that delays execution until after `delay` ms
 * have elapsed since the last call. Cancels pending invocations on unmount.
 * @param {Function} callback - Function to debounce (can change; latest reference is used)
 * @param {number} delay - Debounce delay in milliseconds
 * @returns {Function} Stable debounced function
 */
export function useDebouncedCallback(callback, delay) {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (...args) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
        timeoutRef.current = null;
      }, delay);
    },
    [delay]
  );
}
