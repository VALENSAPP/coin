import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import useScreenshotProtection from '../../hooks/useScreenshotProtection';
import FileViewer from 'react-native-file-viewer';
import RNFS from 'react-native-fs';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import RBSheet from 'react-native-raw-bottom-sheet';
import CommentSheet from '../home/posts/CommentSheet';
import {
  deletePost,
  getPostlikes,
  likePost,
  savePost,
  unSavePost,
  getMarketplaceEbookById,
  getMarketPlaceEbookById,
} from '../../services/post';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../displaytoastmessage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigateClosetReturn } from '../../utils/closetNavigation';

const chaptersFallback = [
  'Build your personal brand',
  'Create content that connects',
  'Monetize your knowledge',
  'Grow your audience',
];

const isValidEbookObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (value.error === true) return false;
  if (typeof value.statusCode === 'number' && value.statusCode >= 400) return false;
  return Boolean(
    value.id ||
      value._id ||
      value.caption ||
      value.title ||
      value.ebookpdf ||
      value.ebookPdf ||
      value.text ||
      value.description ||
      (Array.isArray(value.images) && value.images.length > 0),
  );
};

const extractEbookFromResponse = (res) => {
  const candidates = [
    res?.data?.ebook,
    res?.data?.post,
    res?.data?.data?.ebook,
    res?.data?.data?.post,
    res?.ebook,
    res?.post,
    res?.data?.data,
    res?.data,
    res,
  ];
  for (const candidate of candidates) {
    if (isValidEbookObject(candidate)) return candidate;
  }
  return null;
};

const isMarketplaceEbookItem = (item) => {
  if (!item || typeof item !== 'object') return false;
  if (item.closetId || item.marketplaceEbookId || item.marketplaceId) return true;
  if (item.isMarketplace === true || item.isMarketplace === 'true') return true;
  const source = String(item.source || '').toLowerCase();
  if (source === 'marketplace' || source === 'closet') return true;
  return false;
};

const getDescription = (ebookItem) => {
  const textField = ebookItem?.text ?? ebookItem?.description;
  if (!textField) return 'No description available';

  if (typeof textField === 'string') {
    try {
      const parsed = JSON.parse(textField);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }
    } catch (e) {
      return textField || 'No description available';
    }
  }

  if (Array.isArray(textField) && textField.length > 0) {
    return textField[0];
  }

  return 'No description available';
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

const formatDisplayName = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const EbookDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  console.log('📥 EbookDetailScreen received params:', JSON.stringify(route?.params, null, 2));
  const routeUserData = route?.params?.userData;
  const [ebookData, setEbookData] = useState(route?.params?.ebook || {});
  const ebook = useMemo(() => {
    const profileName =
      routeUserData?.userName ||
      routeUserData?.displayName ||
      routeUserData?.name ||
      '';
    const profileImage =
      routeUserData?.profileImage ||
      routeUserData?.avatar ||
      routeUserData?.image ||
      routeUserData?.profilePic ||
      '';
    const profileUserId = routeUserData?.id || routeUserData?.userId || null;
    return {
      ...ebookData,
      userName: ebookData?.userName || profileName || '',
      userImage: ebookData?.userImage || ebookData?.avatar || profileImage || '',
      userId: ebookData?.userId || profileUserId || ebookData?.user?.id || null,
    };
  }, [ebookData, routeUserData]);
  const fromRootNavigator = route?.params?.fromRootNavigator;
  const fromEbookPublisher = route?.params?.fromEbookPublisher === true;
  const fromMyClosetShopFront = route?.params?.from === 'MyClosetShopFront';

  useEffect(() => {
    if (route?.params?.ebook) {
      setEbookData(prev => ({ ...prev, ...route.params.ebook }));
    }
  }, [route?.params?.ebook]);

  useEffect(() => {
    const fetchEbookDetail = async () => {
      const ebookId = String(
        route?.params?.ebook?.id ||
          route?.params?.ebook?._id ||
          ebookData?.id ||
          ebookData?._id ||
          '',
      ).trim();
      if (!ebookId) return;

      const sourceItem = route?.params?.ebook || ebookData;
      const preferMarketplace = isMarketplaceEbookItem(sourceItem);

      try {
        let resolvedEbook = null;

        if (preferMarketplace) {
          const marketplaceRes = await getMarketplaceEbookById(ebookId);
          resolvedEbook = extractEbookFromResponse(marketplaceRes);
        } else {
          const postRes = await getMarketPlaceEbookById(ebookId);
          resolvedEbook = extractEbookFromResponse(postRes);
          if (!resolvedEbook) {
            const marketplaceRes = await getMarketplaceEbookById(ebookId);
            resolvedEbook = extractEbookFromResponse(marketplaceRes);
          }
        }

        if (resolvedEbook) {
          setEbookData(prev => ({
            ...(prev && typeof prev === 'object' ? prev : {}),
            ...resolvedEbook,
          }));
        }
      } catch (error) {
        console.log('Failed to fetch ebook by ID:', error);
      }
    };

    fetchEbookDetail();
  }, [route?.params?.ebook?.id, route?.params?.ebook?._id]);
  const routeLoggedInUserId = route?.params?.loggedInUserId;
  const { bgStyle,text } = useAppTheme(routeUserData?.profile);
  const { t } = useLanguage();
  const toast = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [holdScreenshotProtection, setHoldScreenshotProtection] = useState(false);
  const commentSheetRef = useRef(null);

  const title = ebook.caption || ebook.title || 'E-book';
  const userName = formatDisplayName(
    ebook.purchasedFrom ||
    route?.params?.username ||
    ebook.userName ||
    ebook.username ||
    ebook.creator?.name ||
    ebook.creator?.username ||
    ebook.user?.name ||
    ebook.user?.username ||
    routeUserData?.shopName ||
    routeUserData?.shopUsername ||
    routeUserData?.displayName ||
    'Unknown Author'
  );
  const userAvatarSource = useMemo(() => {
    const uri = ebook.userImage || ebook.avatar || ebook.user?.avatar || ebook.user?.image || ebook.creator?.avatar || ebook.creator?.image;
    if (uri && typeof uri === 'string' && uri.trim().length > 0) {
      return { uri: uri.trim() };
    }
    return require('../../assets/icons/pngicons/blackUser.png');
  }, [ebook]);
  const description = getDescription(ebook);

  const pdfUrl = useMemo(() => {
    let rawPdf =
      ebook.ebookpdf ||
      ebook.ebookPdf ||
      ebook.pdfUrl ||
      ebook.pdf ||
      ebook.fileUrl;
    if (!rawPdf) {
      const mediaList = [
        ...(Array.isArray(ebook.images) ? ebook.images : []),
        ebook.image,
        ebook.video,
        ebook.media,
      ].filter(Boolean);
      rawPdf = mediaList.find(m => typeof m === 'string' && /\.pdf(\?|$)/i.test(m));
    }
    if (!rawPdf || typeof rawPdf !== 'string') return null;

    const trimmed = rawPdf.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `https://${trimmed}`;
  }, [ebook]);

  const coverImage = useMemo(() => {
    const rawCover = ebook.images?.[0] || ebook.image || null;
    if (typeof rawCover === 'string' && /\.pdf(\?|$)/i.test(rawCover)) {
      return null;
    }
    return rawCover;
  }, [ebook]);

  const allowDownload = useMemo(() => {
    if (!pdfUrl) return false;
    const val = ebook.allowDownload ?? ebook.isAllowDownload;
    return val === true || val === 'true';
  }, [ebook.allowDownload, ebook.isAllowDownload, pdfUrl]);
  const [isLiked, setIsLiked] = useState(!!ebook?.isLike);
  const [likes, setLikes] = useState(ebook?.likeCount || 0);

  const [isSaved, setIsSaved] = useState(ebook?.isSaved || false);
  const [comments, setComments] = useState(ebook?.commentCount || 0);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [liking, setLiking] = useState(false);
  const [commentPostId, setCommentPostId] = useState(null);
  const [commentPostOwnerId, setCommentPostOwnerId] = useState(null);
  const createdAt = formatDate(ebook.createdAt);
  const viewerUserId = currentUserId ?? routeLoggedInUserId ?? null;
  const isOwner = useMemo(() => {
    if (!viewerUserId || !ebook?.userId) return false;
    return String(viewerUserId) === String(ebook.userId);
  }, [viewerUserId, ebook?.userId]);

  const handleBackPress = useCallback(() => {
    const backTarget = route?.params?.returnTo;
    const tabNav = navigation.getParent?.() || navigation;

    if (fromEbookPublisher) {
      tabNav.navigate('wallet', {
        screen: 'EbookPublisher',
      });
      return;
    }

    if (fromMyClosetShopFront) {
      tabNav.navigate('ProfileMain', {
        screen: 'Profile',
        params: { initialTab: 'closet' },
      });
      return;
    }

    // Prefer explicit returnTo from the profile that opened this screen.
    if (backTarget?.tab && backTarget?.screen) {
      tabNav.navigate(backTarget.tab, {
        screen: backTarget.screen,
        params: backTarget.params || {},
      });
      return;
    }

    if (backTarget) {
      navigateClosetReturn(navigation, backTarget);
      return;
    }

    const returnUserId = String(
      route?.params?.returnUserId ||
        routeUserData?.id ||
        routeUserData?.userId ||
        '',
    ).trim();
    const viewerId = String(routeLoggedInUserId || currentUserId || '').trim();

    // Fallback: other user's profile → UsersProfile (not own Profile tab).
    if (returnUserId && (!viewerId || returnUserId !== viewerId)) {
      tabNav.navigate('HomeMain', {
        screen: 'UsersProfile',
        params: {
          userId: returnUserId,
          initialTab: route?.params?.fromProfileTab || 'privateContent',
        },
      });
      return;
    }

    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    tabNav.navigate('ProfileMain', { screen: 'Profile' });
  }, [
    navigation,
    route?.params?.returnTo,
    route?.params?.returnUserId,
    route?.params?.fromProfileTab,
    routeUserData?.id,
    routeUserData?.userId,
    routeLoggedInUserId,
    currentUserId,
    fromEbookPublisher,
    fromMyClosetShopFront,
  ]);

  useScreenshotProtection({
    enabled: !isOwner && !fromEbookPublisher && !fromMyClosetShopFront,
    holdProtection: holdScreenshotProtection,
    title: t('postView.screenshotWarningTitle'),
    message: t('postView.screenshotWarningMessage'),
  });

  useEffect(() => {
    setIsLiked(!!ebook?.isLike);
    setLikes(ebook?.likeCount || 0);
    setIsSaved(!!ebook?.isSaved);
    setComments(ebook?.commentCount || 0);
  }, [ebook?.id, ebook?.isLike, ebook?.isLikeCount, ebook?.likeCount, ebook?.isSaved, ebook?.commentCount]);

  useEffect(() => {
    (async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        setCurrentUserId(id ? String(id) : null);
      } catch (e) {
        console.log('Read userId failed', e);
      }
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadLikeState = async () => {
      if (!ebook?.id) return;
      try {
        const res = await getPostlikes(String(ebook.id));
        const payload = res?.data ?? res;
        const list = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.likes)
              ? payload.likes
              : [];
        const serverCount =
          payload?.likesCount ??
          payload?.totalLikes ??
          payload?.count ??
          list.length;

        const viewerId = currentUserId ? String(currentUserId) : '';
        const serverLiked = list.some(item => {
          const itemUserId = String(item?.userId ?? item?.user?.id ?? item?.likedBy ?? '');
          if (!viewerId) return !!item?.liked || !!item?.isLike;
          return itemUserId && itemUserId === viewerId;
        }) || !!payload?.liked || !!payload?.isLike;

        if (mounted) {
          setLikes(Number(serverCount) || 0);
          setIsLiked(serverLiked);
        }
      } catch (error) {
        console.log('Load like state error', error);
      }
    };

    loadLikeState();
    return () => {
      mounted = false;
    };
  }, [ebook?.id, currentUserId]);

  const handleLike = useCallback(async () => {
    if (!ebook?.id || liking) return;

    const prevLiked = isLiked;
    const prevLikes = likes;
    const nextLiked = !prevLiked;

    setIsLiked(nextLiked);
    setLikes(Math.max(0, prevLikes + (nextLiked ? 1 : -1)));
    setLiking(true);

    try {
      const res = await likePost(String(ebook.id));
      const serverLiked = res?.data?.liked;
      const serverCount = res?.data?.likesCount ?? res?.data?.totalLikes;

      if (typeof serverLiked === 'boolean') {
        setIsLiked(serverLiked);
      }
      if (serverCount !== undefined) {
        setLikes(Math.max(0, Number(serverCount) || 0));
      }
    } catch (error) {
      setIsLiked(prevLiked);
      setLikes(prevLikes);
      console.log('Like Error', error);
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || 'Unable to update like',
      );
    } finally {
      setLiking(false);
    }
  }, [ebook?.id, isLiked, likes, liking, toast]);
  const handleSave = async () => {
    try {
      if (isSaved) {
        await unSavePost(ebook.id);
        setIsSaved(false);
      } else {
        await savePost(ebook.id);
        setIsSaved(true);
      }
    } catch (error) {
      console.log('Save Error', error);
    }
  };
  const handleOpenComments = useCallback(() => {
    if (!ebook?.id) return;
    setCommentPostId(String(ebook.id));
    setCommentPostOwnerId(ebook?.userId ?? null);
    requestAnimationFrame(() => {
      commentSheetRef.current?.open();
    });
  }, [ebook?.id, ebook?.userId]);

  const handleCloseComments = useCallback(() => {
    commentSheetRef.current?.close();
    setCommentPostId(null);
    setCommentPostOwnerId(null);
  }, []);

  const handleCommentCountUpdate = useCallback((postId, newCount) => {
    if (String(postId) !== String(ebook?.id)) return;
    setComments(Math.max(0, Number(newCount) || 0));
  }, [ebook?.id]);
  const handleDelete = () => {
    Alert.alert(
      'Delete E-book',
      'Are you sure you want to delete this e-book?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const resolvedUserId = currentUserId || (await AsyncStorage.getItem('userId'));
              const userId = resolvedUserId ? String(resolvedUserId) : '';
              const postId = ebook?.id ? String(ebook.id) : '';

              if (!postId || !userId) {
                showToastMessage(
                  toast,
                  'danger',
                  'Unable to delete this e-book right now.',
                );
                return;
              }

              let res;
              const fromNav = route?.params?.from;
              if (fromNav === 'MyClosetShopFront' || fromNav === 'Shop') {
                res = await deleteMarketplaceEbook(postId);
              } else {
                res = await deletePost(postId, userId);
              }
              const ok = res?.statusCode === 200 && (res?.success ?? true);

              if (!ok) {
                showToastMessage(
                  toast,
                  'danger',
                  res?.data?.message || res?.message || 'Failed to delete e-book',
                );
                return;
              }

              showToastMessage(
                toast,
                'success',
                res?.data?.message || 'E-book deleted successfully',
              );
              navigation.goBack();
            } catch (error) {
              console.log('Delete Error', error);
              showToastMessage(
                toast,
                'danger',
                error?.response?.data?.message || error?.message || 'Delete failed',
              );
            }
          },
        },
      ],
    );
  };
  const handleReadBook = async () => {
    console.log('📖 Attempting to read ebook. Passed params:', { ebook, pdfUrl });
    if (!pdfUrl) {
      Alert.alert('Error', 'Ebook PDF URL is not available');
      return;
    }
    try {
      if (await InAppBrowser.isAvailable()) {
        await InAppBrowser.open(pdfUrl, {
          dismissButtonStyle: 'close',
          readerMode: false,
          animated: true,
          modalEnabled: true,
          enableBarCollapsing: true,
        });
      } else {
        Alert.alert('Error', 'InAppBrowser is not available on this device');
      }
    } catch (err) {
      console.log('InAppBrowser opening failed:', err);
      Alert.alert('Error', 'Unable to open ebook. Invalid or unreachable PDF link.');
    }
  };
  const chapters = useMemo(() => {
    if (ebook.tableContent) {
      if (typeof ebook.tableContent === 'string') {
        return ebook.tableContent.split(',').map(ch => ch.trim()).filter(ch => ch !== '');
      }
      if (Array.isArray(ebook.tableContent)) {
        return ebook.tableContent.filter(ch => ch !== '');
      }
    }
    return chaptersFallback;
  }, [ebook.tableContent]);

  const handleDownloadPdf = async () => {
    if (!pdfUrl) {
      Alert.alert('Error', 'PDF URL not available');
      return;
    }

    try {
      setIsDownloading(true);
      const fileName = `${title.replace(/\s+/g, '_')}.pdf`;
      const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

      const downloadResult = await RNFS.downloadFile({
        fromUrl: pdfUrl,
        toFile: filePath,
        progress: (res) => {
          const progress = Math.floor((res.bytesWritten / res.contentLength) * 100);
          console.log(`PDF Download progress: ${progress}%`);
        },
      }).promise;

      if (downloadResult.statusCode === 200) {
        Alert.alert('Success', `PDF downloaded successfully`);
        if (!isOwner) {
          setHoldScreenshotProtection(true);
        }
        try {
          await FileViewer.open(filePath, {
            displayName: fileName,
            showOpenWithDialog: true,
          });
        } finally {
          if (!isOwner) {
            setHoldScreenshotProtection(false);
          }
        }
      } else {
        Alert.alert('Error', 'Failed to download PDF');
      }
    } catch (error) {
      console.log('Download error:', error);
      Alert.alert('Download Failed', error.message || 'Unable to download PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <View style={[styles.screen, bgStyle]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#111827" />
          </TouchableOpacity>
          <View style={styles.authorWrap}>
            <View style={styles.avatarStack}>
              <Image source={userAvatarSource} style={styles.avatar} />
              {/* <View style={styles.onlineDot} /> */}
            </View>
            <View style={styles.authorTextWrap}>
              <View style={styles.authorTopLine}>
                <Text style={styles.authorName}>{userName}</Text>
                {/* <Ionicons name="checkmark-circle" size={16} color="#2F80ED" /> */}
              </View>
              <Text style={styles.metaText}>{createdAt}</Text>
            </View>
            {!fromEbookPublisher && !fromMyClosetShopFront ? (
              <View style={[styles.subscriberPill, bgStyle, {borderColor: text}]}>
                <Text style={[styles.subscriberPillText,{color:text}]}>Subscribers</Text>
              </View>
            ) : null}
            {isOwner ? (
              <View>
                <TouchableOpacity
                  onPress={handleDelete}
                  style={styles.deleteButton}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color="#DC2626"
                  />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.postText}>
          {description}
        </Text>

        <View style={styles.previewCard}>
          <View style={styles.cardLeft}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.cover} resizeMode="cover" />
            ) : (
              <View style={styles.cover}>
                <Text style={styles.coverText} numberOfLines={3}>{title}</Text>
                <Text style={styles.coverSub}>E-book</Text>
                <Text style={styles.coverAuthor}>{userName.toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.ebookTitle}>{title}</Text>
            <Text style={styles.byline}>By {userName}</Text>
            <Text style={styles.description}>
              {description}
            </Text>
            <View style={styles.metricsRow}>
              <Text style={styles.metric}>📚 {chapters.length} Chapters</Text>
              {/* <Text style={styles.metric}>📄 {ebook.pages || '?'} Pages</Text> */}
            </View>
          </View>
        </View>

        {allowDownload && (
          <TouchableOpacity
            style={[styles.downloadButton ,{backgroundColor:text}]}
            onPress={handleDownloadPdf}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Text style={[styles.downloadButtonText]}>Download PDF</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.readButton, bgStyle, {borderColor: text}]} onPress={handleReadBook}>
          <Ionicons name="book-outline" size={16} color={text} />
          <Text style={[styles.readButtonText,{color:text}]}>Read e-book</Text>
        </TouchableOpacity>

        {!fromEbookPublisher && !fromMyClosetShopFront ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleLike}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={25}
                color={isLiked ? '#ef4444' : '#6b7280'}
              />
              <Text style={styles.actionCount}>{likes}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleOpenComments}>
              <Ionicons name="chatbubble-outline" size={25} color="#6b7280" />
              <Text style={styles.actionCount}>{comments}</Text>
            </TouchableOpacity>
            <View style={styles.actionSpacer} />
            <TouchableOpacity
              style={styles.bookmarkBtn}
              onPress={handleSave}
            >
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={25}
                color={isSaved ? '#5A2D82' : '#6b7280'}
              />
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <RBSheet
        ref={commentSheetRef}
        height={500}
        openDuration={250}
        draggable={true}
        closeOnPressMask={true}
        customModalProps={{ statusBarTranslucent: true }}
        customStyles={{
          container: [styles.commentSheetContainer, bgStyle],
          draggableIcon: {
            backgroundColor: '#ccc',
            width: 60,
          },
        }}
      >
        <CommentSheet
          postId={commentPostId}
          postOwnerId={commentPostOwnerId}
          onClose={handleCloseComments}
          onCommentCountUpdate={handleCommentCountUpdate}
        />
      </RBSheet>
    </View>
  );
};

export default memo(EbookDetailScreen);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,

  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: '10%'
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  authorWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 15
  },
  avatarStack: {
    marginRight: 10,
    position: 'relative',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ade80',
    borderWidth: 2,
    borderColor: '#fff',
  },
  authorTextWrap: { flex: 1 },
  authorTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  metaText: { fontSize: 11, color: '#8b8b94', marginTop: 1 },
  subscriberPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 8,
  },
  subscriberPillText: { fontSize: 11, color: '#6b4b8f', fontWeight: '700' },
  menuBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#202124',
    marginBottom: 12,
  },
  previewCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ece5f5',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardLeft: { marginRight: 12 },
  cover: {
    width: 112,
    height: 160,
    borderRadius: 10,
    justifyContent: 'space-between',
  },
  coverText: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  coverSub: { color: '#E8DAF7', fontSize: 10, fontWeight: '600' },
  coverAuthor: { color: '#fff', fontSize: 10, letterSpacing: 1.1 },
  cardRight: { flex: 1 },
  ebookTitle: { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 4 },
  byline: { fontSize: 12, color: '#7b7b85', marginBottom: 10 },
  description: { fontSize: 13, color: '#4b5563', lineHeight: 19, marginBottom: 10 },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  metric: { fontSize: 11, color: '#6b7280', fontWeight: '700' },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    gap: 6,
    marginTop: 14,
  },
  readButtonText: { color: '#5A2D82', fontWeight: '800' },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5A2D82',
    borderRadius: 14,
    paddingVertical: 11,
    gap: 6,
    marginTop: 10,
  },
  downloadButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
    marginLeft:10,
    marginTop:10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
  },
  actionSpacer: { flex: 1 },
  bookmarkBtn: {
    width: 34,
    alignItems: 'flex-end',
    marginRight:10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 10, marginTop: 6 },
  learnList: {
    paddingBottom: 14,
  },
  learnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  learnBullet: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#5A2D82',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  chapterText: { fontSize: 13, color: '#1F2937', fontWeight: '600', flex: 1 },
  commentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
    backgroundColor: '#fff',
  },
  commentAvatar: { width: 26, height: 26, borderRadius: 13, marginRight: 10 },
  commentPlaceholder: { flex: 1, color: '#9ca3af', fontSize: 13 },
  sendBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  commentSheetContainer: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    shadowColor: '#DC2626',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
