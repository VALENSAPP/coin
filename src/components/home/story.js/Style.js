import { StyleSheet, Platform, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const modalStyles = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: '#000' },
  /** Edge-to-edge image behind progress bar, header, and bottom actions (Instagram-style). */
  storyMediaFullscreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 0,
  },
  storyMediaFill: {
    width: '100%',
    height: '100%',
  },
  /** Fixed overlay for progress + header — never shifts when media loads or fails. */
  storyUiOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 4,
  },
  progressBarBg: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
  },
  progressBarFill: { height: '100%', borderRadius: 1, backgroundColor: 'white' },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  username: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 12 },
  time: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginLeft: 8 },
  closeBtn: { padding: 8 },
  storyContent: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingBottom: 0,
    zIndex: 1,
  },
  // Reserve space for own-story bottom action bar (Delete/Share).
  storyContentOwn: {
    paddingBottom: Platform.OS === 'ios' ? 108 : 92,
  },
  // `height: '100%'` often resolves to 0 here; flex + minHeight keeps Video/Image visible.
  storyMedia: {
    width: SCREEN_WIDTH,
    flex: 1,
    minHeight: Math.max(240, Math.round(SCREEN_HEIGHT * 0.55)),
    backgroundColor: '#000',
  },
  storyVideoWrap: {
    flex: 1,
    width: SCREEN_WIDTH,
    alignSelf: 'stretch',
    position: 'relative',
  },
  /** Bottom layer: keep below poster so a black decoder frame does not cover the thumb. */
  storyVideoPlayerLayer: {
    width: SCREEN_WIDTH,
    flex: 1,
    minHeight: Math.max(240, Math.round(SCREEN_HEIGHT * 0.55)),
    backgroundColor: '#000',
    zIndex: 0,
  },
  /** Cover frame while video buffers; must be above `storyVideoPlayerLayer`. */
  storyVideoPosterLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    backgroundColor: '#0a0a0a',
  },
  storyVideoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 2,
  },
  /** Thumbnail is visible underneath — lighter veil so the poster stays readable while loading. */
  storyVideoLoadingOverlayWithPoster: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
  },
});

export const likeStyles = StyleSheet.create({
  bigHeart: { position: 'absolute', alignSelf: 'center', top: '40%' },
  actionBtn: { padding: 6 },
});

export const inputStyles = StyleSheet.create({
  /** Story viewer message bar (flex child at bottom — do not use position:absolute or story tap layer covers it). */
  wrap: {
    width: '100%',
    zIndex: 50,
    elevation: 24,
    paddingTop: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  quickRow: {
    flexDirection: 'row',
    marginBottom: 8,
    // flexWrap: 'wrap',
    gap: 6,
    marginLeft:18
  },
  quickBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    marginRight: 6,
  },
  quickText: { color: '#fff', fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,20,0.92)',
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    minHeight: 48,
    bottom: 5
  },
  input: {
    flex: 1,
    color: '#fff',
    paddingRight: 12,
    marginLeft: 6,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    minHeight: 44,
    fontSize: 16,
  },
  sendBtn: { padding: 10, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
});

export const optStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    marginTop: 8,
    marginBottom: 12,
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', paddingHorizontal: 16, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomColor: '#222',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { color: '#fff', fontSize: 16 },
  cancel: { justifyContent: 'center' },
  cancelText: {
    color: '#4da3ff',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    width: '100%',
    paddingVertical: 14,
  },
});

export const burstStyles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 9 },
  emoji: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 110 : 90,
    fontSize: 28,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
