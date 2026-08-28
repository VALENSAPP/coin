import { useRef, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
 
const COLLAPSE_COOLDOWN_MS = Platform.OS === 'ios' ? 550 : 400;
const COLLAPSE_SCROLL_THRESHOLD = Platform.OS === 'ios' ? 10 : 30;
 
export function useProfileHeaderCollapse() {
  const [compactLocked, setCompactLocked] = useState(false);
  const compactLockedRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const collapseCooldownRef = useRef(0);
  const isUserDraggingRef = useRef(false);
 
  useEffect(() => {
    compactLockedRef.current = compactLocked;
  }, [compactLocked]);
 
  const expandProfileHeader = useCallback(() => {
    if (!compactLockedRef.current) return;
    compactLockedRef.current = false;
    setCompactLocked(false);
  }, []);
 
  const collapseProfileHeader = useCallback(() => {
    if (compactLockedRef.current) return;
    compactLockedRef.current = true;
    collapseCooldownRef.current = Date.now() + COLLAPSE_COOLDOWN_MS;
    setCompactLocked(true);
  }, []);
 
  const resetProfileHeader = useCallback(() => {
    compactLockedRef.current = false;
    lastScrollYRef.current = 0;
    collapseCooldownRef.current = 0;
    isUserDraggingRef.current = false;
    setCompactLocked(false);
  }, []);
 
  const handleProfileScroll = useCallback((event) => {
    const rawY = event?.nativeEvent?.contentOffset?.y ?? 0;
    const y = Math.max(0, rawY);
    const dy = y - lastScrollYRef.current;
    lastScrollYRef.current = y;
 
    if (!compactLockedRef.current && y > COLLAPSE_SCROLL_THRESHOLD && dy > 0.5) {
      collapseProfileHeader();
      return;
    }
 
    if (
      compactLockedRef.current &&
      isUserDraggingRef.current &&
      rawY <= -4 &&
      Date.now() > collapseCooldownRef.current
    ) {
      expandProfileHeader();
    }
  }, [collapseProfileHeader, expandProfileHeader]);
 
  const handleScrollBeginDrag = useCallback(() => {
    isUserDraggingRef.current = true;
  }, []);
 
  const handleScrollEndDrag = useCallback((event) => {
    isUserDraggingRef.current = false;
    const rawY = event?.nativeEvent?.contentOffset?.y ?? 0;
 
    if (
      compactLockedRef.current &&
      rawY <= -8 &&
      Date.now() > collapseCooldownRef.current
    ) {
      expandProfileHeader();
    }
  }, [expandProfileHeader]);
 
  const handleMomentumScrollEnd = useCallback((event) => {
    const rawY = event?.nativeEvent?.contentOffset?.y ?? 0;
    lastScrollYRef.current = Math.max(0, rawY);
  }, []);
 
  const wrapOnRefresh = useCallback((refreshFn) => async () => {
    if (compactLockedRef.current) {
      expandProfileHeader();
      return;
    }
    await refreshFn();
  }, [expandProfileHeader]);
 
  return {
    compactLocked,
    expandProfileHeader,
    resetProfileHeader,
    wrapOnRefresh,
    scrollViewProps: {
      onScroll: handleProfileScroll,
      onScrollBeginDrag: handleScrollBeginDrag,
      onScrollEndDrag: handleScrollEndDrag,
      onMomentumScrollEnd: handleMomentumScrollEnd,
      scrollEventThrottle: 16,
      nestedScrollEnabled: true,
      bounces: true,
      alwaysBounceVertical: true,
      keyboardShouldPersistTaps: 'handled',
    },
  };
}
 