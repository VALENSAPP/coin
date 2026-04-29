import { Platform, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default StyleSheet.create({
  /* -------------------------------------------------------
      GENERAL CONTAINER + SEARCH BAR
  ------------------------------------------------------- */
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    paddingHorizontal: 12,
    // paddingVertical: 3,
    marginBottom: 16,
    borderWidth: 1.5,
    borderRadius: 24,
    borderColor: "#e6e6e6",
   marginTop: Platform.OS === 'android' ? 35 : 55,
   paddingVertical: Platform.OS === 'android' ? 3 : 10
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

  searchBattlesSection: {
    paddingTop: 8,
    paddingBottom: 24,
  },

  searchBattleCardWrapper: {
    marginBottom: 14,
  },

  searchBattlesEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },

  /* -------------------------------------------------------
      MISSION PROGRESS BAR STYLES
  ------------------------------------------------------- */
  missionBadgeWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 10,
  },

  progressContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 3,
  },

  progressSection: {
    marginTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },

  progressBarWrapper: {
    position: 'relative',
  },

  progressBarBackground: {
    height: 6,
    backgroundColor: '#4B5563',
    overflow: 'hidden',
    marginBottom: 8,
    borderRadius: 3,
  },

  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  progressStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
  },

  statAtStart: {
    flex: 1,
    alignItems: 'flex-start',
  },

  statAtCenter: {
    flex: 1,
    alignItems: 'center',
  },

  statAtEnd: {
    flex: 1,
    alignItems: 'flex-end',
  },

  statValueSmall: {
    fontSize: 7,
    fontWeight: '400',
    color: '#FFFFFF',
  },

  card: {
    width: 280,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    marginRight: 12,

    // shadow
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  pollCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  pollAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  pollAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D8B4FE',
  },
  pollAvatarFallbackText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4C1D95',
  },
  pollCreatorText: {
    flex: 1,
    marginLeft: 10,
  },
  pollCreatorName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  pollCreatorHandle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  pollFormatPill: {
    backgroundColor: '#F3E8FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pollFormatText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.4,
  },
  pollQuestion: {
    marginTop: 12,
    color: '#111827',
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 20,
  },
  pollOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  pollOptionChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pollOptionChipSelected: {
    backgroundColor: '#7C3AED',
  },
  pollOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  pollOptionTextSelected: {
    color: '#FFFFFF',
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  userBox: {
    alignItems: 'center',
    width: 70,
  },

  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  avatarFallbackText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#374151',
  },

  name: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    color: '#111827',
    textAlign: 'center',
  },
  handleText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },

  vs: {
    fontSize: 16,
  },

  title: {
    marginTop: 6,
    color: '#6B7280',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  headToHeadOptionsWrap: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  headToHeadOptionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  headToHeadOptionButtonSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  headToHeadOptionText: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#374151',
  },
  headToHeadOptionTextSelected: {
    color: '#FFFFFF',
  },

  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  battleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    columnGap: 10,
  },
  battleMetaText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
  },
  battlePrimaryAction: {
    marginTop: 12,
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  battlePrimaryActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  battleFooterDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 12,
    marginHorizontal: -10,
  },
  battleStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 15,
  },
  battleStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  battleStatText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  battleStatDot: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '700',
  },

});
