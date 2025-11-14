import { Platform, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default StyleSheet.create({
  /* -------------------------------------------------------
      GENERAL CONTAINER + SEARCH BAR
  ------------------------------------------------------- */
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 16,
    borderWidth: 1.5,
    borderRadius: 24,
    borderColor: "#e6e6e6",
   marginTop: Platform.OS === 'android' ? 35 : 55
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },

  /* -------------------------------------------------------
      SEARCH RESULTS — GRID & LIST
  ------------------------------------------------------- */
  resultsContainer: {
    flex: 1,
    paddingBottom: 30,
  },

  listContent: {
    paddingBottom: 20,
    paddingHorizontal: 10,
  },

  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  gridCard: {
    width: (SCREEN_WIDTH - 30) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  gridImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
  },

  gridCardContent: {
    alignItems: 'center',
    width: '100%',
  },

  gridTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
    textAlign: 'center',
  },

  gridUser: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },

  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },

  resultHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 12,
  },

  resultCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },

  /* -------------------------------------------------------
      MASONRY GRID (POSTS)
  ------------------------------------------------------- */
  masonryWrapper: {
    flex: 1,
    width: SCREEN_WIDTH,
    marginLeft: -12,
    marginRight: -12,
  },

  masonryContainer: {
    position: 'relative',
    width: SCREEN_WIDTH,
    paddingBottom: 10,
  },

  masonryItem: {
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },

  gridItem: {
    margin: 1,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    width: (SCREEN_WIDTH - 32 - 6) / 3,
    height: (SCREEN_WIDTH - 32 - 6) / 3,
  },

  media: {
    width: '100%',
    height: '100%',
  },

  videoIconOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 4,
  },

  /* -------------------------------------------------------
      PREVIEW MODAL
  ------------------------------------------------------- */
  previewOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  previewBackdrop: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },

  previewContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  previewMediaWrapper: {
    width: SCREEN_WIDTH * 0.92,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
  },

  previewMedia: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.75,
  },

  previewFallback: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.75,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
  },

  previewFallbackText: {
    color: '#fff',
    fontSize: 16,
  },

  previewCloseButton: {
    position: 'absolute',
    top: 40,
    right: 24,
    zIndex: 2,
  },

  /* -------------------------------------------------------
      USER LIST & GRID ITEMS
  ------------------------------------------------------- */
  userListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e0e0',
    marginRight: 12,
  },

  userInfo: {
    flex: 1,
  },

  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },

  userHandle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },

  userGridItem: {
    width: (SCREEN_WIDTH - 42) / 2,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  userGridAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0e0e0',
    marginBottom: 8,
  },

  userGridName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginVertical: 12,
    paddingHorizontal: 12,
  },

  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});
