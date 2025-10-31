import { StyleSheet, Platform, Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export const modalStyles = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: '#000' },
  overlay: {
  ...StyleSheet.absoluteFillObject, 
  backgroundColor: 'transparent',
},
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
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
  storyContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  storyMedia: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.75 },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
  },
});

export const likeStyles = StyleSheet.create({
  bigHeart: { position: 'absolute', alignSelf: 'center', top: '40%' },
  bottomBar: {},
  leftActions: {},
  actionBtn: { padding: 6 },
});

export const inputStyles = StyleSheet.create({
  wrap: {
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
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
    backgroundColor: 'rgba(20,20,20,0.8)',
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  input: { flex: 1, color: '#fff', paddingRight: 12, marginLeft: 6 },
  sendBtn: { padding: 6 },
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
