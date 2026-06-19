import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Platform,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Keyboard,
  findNodeHandle,
  DeviceEventEmitter,
  Switch,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { StackActions, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomButton from '../../../components/customButton/customButton';
import { useToast } from 'react-native-toast-notifications';
import { createPost, editPost } from '../../../services/post';
import { getAllUser } from '../../../services/users';
import {
  buildPostUploadPayloadFromImages,
  getPostSlidePreviewState,
  parsePostMeta,
  cacheClientPostOverlayFields,
  mergePostOverlayFieldsFromClient,
} from '../../../utils/postSoundtracks';
import PostMediaTextOverlays from '../../../components/post/PostMediaTextOverlays';
import { getPostMediaFormat } from '../../../utils/postMediaFormat';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../../theme/useApptheme';
import { useLanguage } from '../../../i18n';
import { navigateToUserProfile } from '../../../utils/navigateToUserProfile';
import { isLocalMediaUri } from '../../../utils/hydratePostForEditor';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const HEADER_HEIGHT = 56;
const IMAGE_PREVIEW_WIDTH = screenWidth * 0.92;
const MAX_SELECTED_PREVIEW_HEIGHT = screenHeight * 0.5;
const IMAGE_PREVIEW_MIN_HEIGHT = IMAGE_PREVIEW_WIDTH * 0.35;
const MEDIA_PREVIEW_MARGIN = 16;

const getPreviewHeightForMedia = (media) => {
  const mediaWidth = Number(media?.width);
  const mediaHeight = Number(media?.height);
  if (!mediaWidth || !mediaHeight) {
    return MAX_SELECTED_PREVIEW_HEIGHT;
  }
  const aspectHeight = (IMAGE_PREVIEW_WIDTH * mediaHeight) / mediaWidth;
  return Math.min(
    MAX_SELECTED_PREVIEW_HEIGHT,
    Math.max(IMAGE_PREVIEW_MIN_HEIGHT, aspectHeight),
  );
};

const getVideoPreviewHeight = (media, isFlipPost) => {
  const isHorizontalVideo =
    Number(media?.width) > 0 &&
    Number(media?.height) > 0 &&
    Number(media.width) > Number(media.height);
  if (isFlipPost || isHorizontalVideo) {
    return screenHeight * 0.5;
  }
  return getPreviewHeightForMedia(media);
};

const PostEditorScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const returnTo = route?.params?.returnTo || route?.params?.params?.returnTo;

  const navigateAfterPostCreated = useCallback(() => {
    DeviceEventEmitter.emit('POST_UPLOAD_RESET');
    // Always take the user to Home after successful post creation.
    // Avoids returning to intermediate upload/editor screens.
    navigation.dispatch(StackActions.popToTop());
    navigation.navigate('HomeMain', { screen: 'Home' });
    DeviceEventEmitter.emit('HOME_TAB_PRESS');
  }, [navigation]);

  const navigateBackOrReturnTo = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    // if (returnTo && typeof returnTo === 'object') {
    //   const tab = returnTo?.tab;
    //   const screen = returnTo?.screen;
    //   const params = returnTo?.params;
    //   if (tab) {
    //     navigation.navigate(tab, screen ? { screen, params } : undefined);
    //     return;
    //   }
    // }

    // if (typeof returnTo === 'string' && returnTo.length) {
    //   navigation.navigate(returnTo);
    //   return;
    // }

    navigation.navigate('HomeMain');
  }, [navigation]);
  const {
    images = [],
    currentFilter = 'none',
    metadata = {},
    imageEdits,
    postType,
    visibleTo,
    fromIcon,
    taggedPeople = [],
    taggedPeopleIds = [],
    taggedPeopleMeta = [],
    isEditingPost = false,
    editPostId = null,
    editSkipMediaEditor = false,
    initialCaption = '',
    initialLocation = '',
    isTrustPost = false,
    onSave,
    initialPostMeta = null,
  } = route.params || {};
  const parsedInitialPostMeta = useMemo(
    () => (initialPostMeta ? parsePostMeta(initialPostMeta) : null),
    [initialPostMeta],
  );
  const [editorImages, setEditorImages] = useState(images);
  const [caption, setCaption] = useState(isEditingPost ? initialCaption : '');
  const [link, setLink] = useState('');
  const [isCommunityTrustPost, setIsCommunityTrustPost] = useState(
    isEditingPost ? isTrustPost : false,
  );
  const [profile, setProfile] = useState(null);
  const [openingTaggedProfile, setOpeningTaggedProfile] = useState(false);
  const [iosKeyboardInset, setIosKeyboardInset] = useState(0);
  const iosScrollRef = useRef(null);
  const captionInputRef = useRef(null);
  const linkInputRef = useRef(null);
  const iosFocusedFieldRef = useRef(null);
  const { bgStyle, textStyle, cardStyle, text, border, mutedText, icon, accent } = useAppTheme();
  const { t } = useLanguage();

  const toast = useToast();
  console.log('PostEditor received data:', { images, currentFilter, metadata, imageEdits, postType });

  const getMediaUri = (media) =>
    media?.processedUri ||
    media?.originalUri ||
    media?.path ||
    media?.uri ||
    media?.sourceURL ||
    '';

  const getMediaKey = (media, index) =>
    media?.processedUri ||
    media?.originalUri ||
    media?.path ||
    media?.uri ||
    media?.sourceURL ||
    `media-${index}`;

  const isMediaVideo = (media) => {
    if (!media) return false;
    if (media?.isVideo === true) return true;
    if (typeof media?.type === 'string' && media.type.toLowerCase().includes('video')) return true;
    if (Number(media?.duration) > 0) return true;
    const uri = getMediaUri(media).toLowerCase();
    return ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.3gp'].some(ext => uri.includes(ext));
  };

  const getVideoPosterUri = (media) =>
    media?.thumbnail ||
    media?.thumb ||
    media?.poster ||
    media?.previewUri ||
    '';

  useEffect(() => {
    const loadProfileType = async () => {
      const type = await AsyncStorage.getItem('profile');
      console.log('Loaded profile type:', type);
      setProfile(type);
    };
    loadProfileType();
  }, []);

  useEffect(() => {
    setEditorImages(images);
  }, [images]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    const onShow = (e) => {
      setIosKeyboardInset(e?.endCoordinates?.height ?? 0);
    };
    const onHide = () => {
      setIosKeyboardInset(0);
      iosFocusedFieldRef.current = null;
    };
    const showSub = Keyboard.addListener('keyboardWillShow', onShow);
    const hideSub = Keyboard.addListener('keyboardWillHide', onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollIosFieldIntoView = useCallback((fieldRef) => {
    if (Platform.OS !== 'ios') return;
    const scroll = iosScrollRef.current;
    if (!scroll) return;
    const scrollResponder =
      typeof scroll.getScrollResponder === 'function'
        ? scroll.getScrollResponder()
        : null;
    if (!scrollResponder?.scrollResponderScrollNativeHandleToKeyboard) {
      return;
    }
    const run = () => {
      const field = fieldRef?.current;
      const nativeNode = field ? findNodeHandle(field) : null;
      if (!nativeNode) return;
      try {
        scrollResponder.scrollResponderScrollNativeHandleToKeyboard(nativeNode, 160, true);
      } catch {
        // ignore (e.g. ref not yet attached to native layer)
      }
    };
    requestAnimationFrame(() => {
      setTimeout(run, 100);
      setTimeout(run, 280);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      const r = iosFocusedFieldRef.current;
      if (r) {
        setTimeout(() => scrollIosFieldIntoView(r), 60);
      }
    });
    return () => sub.remove();
  }, [scrollIosFieldIntoView]);

  const navigateAfterPostUpdated = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.pop(editSkipMediaEditor ? 1 : 2);
      return;
    }
    navigation.navigate('HomeMain');
  }, [navigation, editSkipMediaEditor]);

  const handlePost = async () => {
    if (postType == 'crowdfunding') {
      if (link && !isValidLink(link)) {
        showToastMessage(toast, 'danger', t('postEditor.invalidLink'));
        return;
      }

      navigation.navigate('CreateMission', {
        images: editorImages,
        caption,
        link,
        taggedPeople,
        taggedPeopleIds,
        taggedPeopleMeta,
        isTrustPost: isCommunityTrustPost,
      });
      return;
    }

    dispatch(showLoader());
    const isFlipPost = fromIcon === 'Flips' || postType === 'flip';
    const primaryMedia = editorImages[0];

    const payload = {
      caption: caption.trim(),
      taggedPeople: taggedPeopleIds,
      // Array.isArray(taggedPeople) ? taggedPeople.join(', ') : taggedPeople,
      // ...(Array.isArray(taggedPeopleIds) && taggedPeopleIds.length ? { taggedPeopleIds } : {}),
      // ...(Array.isArray(taggedPeopleMeta) && taggedPeopleMeta.length ? { taggedPeopleMeta } : {}),
      media: editorImages.map(img => ({
        uri: getMediaUri(img),
        type: img.type,
        name: getMediaUri(img).split('/').pop()
      })),
      type:
        postType === 'private_circle' ? 'private_circle' :
          postType === 'private'
            ? 'private'
            : fromIcon === 'Flips'
              ? 'reel'
              : 'normal',
      visibleTo: visibleTo,
      isTrustPost: isCommunityTrustPost,
      ...(postType === 'private' &&
        (fromIcon === 'Flips' || fromIcon === 'video')
        ? {
          format: fromIcon === 'Flips' ? 'reel' : fromIcon === 'video' ? 'video' : 'normal',
        }
        : {}),
      // ...(isFlipPost && primaryMedia
      //   ? { format: getPostMediaFormat(primaryMedia) }
      //   : {}),
    };

    const uploadPayload = buildPostUploadPayloadFromImages(editorImages);
    const { postMeta, music, youtubeMusicMeta, videoText, videoTextItems } = uploadPayload;

    const localMedia = editorImages
      .map(img => ({
        uri: getMediaUri(img),
        type: img.type || (isMediaVideo(img) ? 'video/mp4' : 'image/jpeg'),
        name: getMediaUri(img).split('/').pop(),
      }))
      .filter(file => isLocalMediaUri(file.uri));

    if (isEditingPost && editPostId) {
      try {
        const preservedPostMeta = parsedInitialPostMeta || postMeta;
        const editPayload = editSkipMediaEditor
          ? {
              caption: caption.trim(),
              taggedPeople: taggedPeopleIds,
              isTrustPost: isCommunityTrustPost,
              ...(Array.isArray(taggedPeopleIds) && taggedPeopleIds.length
                ? { taggedPeopleIds, taggedPeopleMeta }
                : {}),
            }
          : {
              caption: caption.trim(),
              taggedPeople: taggedPeopleIds,
              ...(Array.isArray(taggedPeopleIds) && taggedPeopleIds.length
                ? { taggedPeopleIds, taggedPeopleMeta }
                : {}),
              postMeta,
              ...(music ? { music } : { music: '' }),
              ...(youtubeMusicMeta ? { youtubeMusicMeta } : { youtubeMusicMeta: '' }),
              ...(videoText ? { videoText, videoTextItems } : {}),
              ...(localMedia.length ? { media: localMedia } : {}),
            };

        const response = await editPost(editPostId, editPayload);

        if (response?.statusCode && response.statusCode >= 400) {
          throw new Error(response?.message || t('editPost.updateFailed'));
        }

        const updatedFromApi =
          response?.data?.data ||
          response?.data ||
          response ||
          {};
        const updatedPost = {
          id: editPostId,
          ...updatedFromApi,
          caption: updatedFromApi?.caption ?? caption.trim(),
          postMeta: preservedPostMeta,
          music: editSkipMediaEditor ? updatedFromApi?.music : music || null,
          youtubeMusicMeta: editSkipMediaEditor
            ? updatedFromApi?.youtubeMusicMeta
            : youtubeMusicMeta || null,
        };

        onSave?.(updatedPost);
        if (!editSkipMediaEditor) {
          cacheClientPostOverlayFields(editPostId, {
            postMeta,
            music,
            youtubeMusicMeta,
          });
        }
        showToastMessage(
          toast,
          'success',
          response?.data?.message || response?.message || t('editPost.postUpdated'),
        );
        navigateAfterPostUpdated();
      } catch (err) {
        console.error('Post update error:', err);
        showToastMessage(
          toast,
          'danger',
          err?.response?.data?.message || err?.message || t('editPost.updateFailed'),
        );
      } finally {
        dispatch(hideLoader());
      }
      return;
    }

    try {
      const response = await createPost({
        ...payload,
        postMeta,
        ...(music ? { music } : {}),
        ...(youtubeMusicMeta ? { youtubeMusicMeta } : {}),
        ...(videoText ? { videoText, videoTextItems } : {}),
      });
      console.log('Post creation response:', response);

      if (response.statusCode == 200) {
        const created =
          response?.data?.data ||
          response?.data?.post ||
          response?.data ||
          {};
        const createdPostId = created?.id || created?.postId;
        const overlayFields = { postMeta, music, youtubeMusicMeta };
        if (createdPostId) {
          cacheClientPostOverlayFields(createdPostId, overlayFields);
          DeviceEventEmitter.emit(
            'POST_CREATED',
            mergePostOverlayFieldsFromClient(created, overlayFields),
          );
        }
        showToastMessage(toast, 'success', t('postEditor.postSuccess'));
        navigateAfterPostCreated();
      } else {
        showToastMessage(toast, 'danger', response.message || t('postEditor.postFail'));
      }
    } catch (err) {
      console.error('Post creation error:', err);
      showToastMessage(toast, 'danger', err?.response?.message || t('postEditor.postError'));
    } finally {
      dispatch(hideLoader());
    }
  };

  const isValidLink = (text) => {
    const urlPattern = /^(https?:\/\/)?([\w.-]+)\.([a-z]{2,})([\/\w .-]*)*\/?$/i;
    return urlPattern.test(text);
  };

  const removeDrawingFromImage = useCallback((index) => {
    setEditorImages(prev =>
      prev.map((img, i) => {
        if (i !== index) return img;
        const revert = img.uriBeforeAnyDrawing;
        if (!revert) return img;
        return {
          ...img,
          processedUri: revert,
          drawings: null,
        };
      }),
    );
  }, []);

  const resolveUserIdFromUsername = useCallback(async (incomingUsername) => {
    const cleanUsername = decodeURIComponent(String(incomingUsername || '').trim()).replace(/^@+/, '');
    if (!cleanUsername) return null;

    try {
      const response = await getAllUser({ userName: cleanUsername });
      const users = response?.data?.users ?? [];
      const exactMatch = users.find((u) =>
        String(u?.userName || u?.username || '').toLowerCase() === cleanUsername.toLowerCase()
      );
      const fallbackUser = exactMatch || users[0];
      return fallbackUser?.id || fallbackUser?._id || fallbackUser?.userId || null;
    } catch (error) {
      console.log('Username resolution failed:', error?.message || error);
      return null;
    }
  }, []);

  const openTaggedUserProfile = useCallback(async (username) => {
    const cleanUsername = String(username || '').trim().replace(/^@+/, '');
    if (!cleanUsername) return;

    setOpeningTaggedProfile(true);
    try {
      const resolvedUserId = await resolveUserIdFromUsername(cleanUsername);
      if (!resolvedUserId) {
        showToastMessage(toast, 'danger', t('postEditor.openProfileError'));
        return;
      }

      void navigateToUserProfile(navigation, resolvedUserId, {
        returnParams: {
          returnTo: { tab: 'Add' },
        },
      });
    } finally {
      setOpeningTaggedProfile(false);
    }
  }, [navigation, resolveUserIdFromUsername, toast, t]);

  const isFlipPost = fromIcon === 'Flips' || postType === 'flip';

  const getThumbHeight = (img) =>
    isMediaVideo(img)
      ? getVideoPreviewHeight(img, isFlipPost)
      : getPreviewHeightForMedia(img);

  const renderMediaPreviewItem = (img, idx) => {
    const thumbHeight = getThumbHeight(img);
    const preview = getPostSlidePreviewState({
      mediaUri: getMediaUri(img),
      fallbackImage: img,
      parsedPostMeta: parsedInitialPostMeta,
      slideIndex: idx,
      preferLayerOverlays: isMediaVideo(img),
      isVideoSlide: isMediaVideo(img),
    });
    const { overlayBundle, showOverlays } = preview;

    if (isMediaVideo(img)) {
      return (
        <View
          key={getMediaKey(img, idx)}
          style={[styles.mediaPreviewCard, { height: thumbHeight }]}
        >
          <Video
            source={{ uri: preview.uri }}
            style={{ width: IMAGE_PREVIEW_WIDTH, height: thumbHeight }}
            resizeMode="cover"
            paused={true}
            muted={true}
            controls={false}
            poster={getVideoPosterUri(img) || undefined}
          />
          {showOverlays ? (
            <PostMediaTextOverlays
              textOverlays={overlayBundle.textOverlays}
              overlayImages={overlayBundle.overlayImages}
              musicSticker={overlayBundle.musicSticker}
              width={IMAGE_PREVIEW_WIDTH}
              height={thumbHeight}
              canvasWidth={overlayBundle.canvasWidth}
              canvasHeight={overlayBundle.canvasHeight}
            />
          ) : null}
          <View style={styles.videoPlayOverlay}>
            <Icon name="play" size={20} color="#fff" />
          </View>
          <View style={styles.videoDurationBadge}>
            <Icon name="videocam" size={10} color="#fff" />
            <Text style={styles.videoDurationText}>
              {img.duration ? `${Math.floor(img.duration / 1000)}s` : '0:00'}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View
        key={getMediaKey(img, idx)}
        style={[styles.mediaPreviewCard, { height: thumbHeight }]}
      >
        <Image
          source={{ uri: preview.uri }}
          style={styles.mediaPreviewFill}
          resizeMode="contain"
        />
        {showOverlays ? (
          <PostMediaTextOverlays
            textOverlays={overlayBundle.textOverlays}
            overlayImages={overlayBundle.overlayImages}
            musicSticker={overlayBundle.musicSticker}
            width={IMAGE_PREVIEW_WIDTH}
            height={thumbHeight}
            canvasWidth={overlayBundle.canvasWidth}
            canvasHeight={overlayBundle.canvasHeight}
          />
        ) : null}
        {img.drawings && img.uriBeforeAnyDrawing && (
          <TouchableOpacity
            style={styles.removeDrawingBtn}
            onPress={() => removeDrawingFromImage(idx)}
            activeOpacity={0.8}
          >
            <Text style={[styles.removeDrawingText, { color: text }]}>
              {' '}
              {t('postEditor.removeDrawing')}
            </Text>
          </TouchableOpacity>
        )}
        {img.appliedFilter && img.appliedFilter !== 'none' && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{img.filterName}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderMediaPreviewSection = () => {
    if (!editorImages.length) return null;

    if (editorImages.length === 1) {
      return (
        <View style={styles.mediaPreviewSection}>
          {renderMediaPreviewItem(editorImages[0], 0)}
        </View>
      );
    }

    return (
      <View style={styles.mediaPreviewSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mediaPreviewScrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
          {editorImages.map((img, idx) => renderMediaPreviewItem(img, idx))}
        </ScrollView>
      </View>
    );
  };

  const renderEditorBody = () => (
    <>
      {renderMediaPreviewSection()}

      {Array.isArray(taggedPeople) && taggedPeople.length > 0 && (
        <View style={styles.captionSection}>
          <Text style={styles.captionLabel}>{t('postEditor.taggedPeople')}</Text>
          <Text style={[styles.taggedPeopleText, textStyle]}>
            {taggedPeople.map((user, idx) => {
              const clean = String(user).replace(/^@+/, '');
              const label = `@${clean}${idx < taggedPeople.length - 1 ? ', ' : ''}`;
              return (
                <Text
                  key={`${clean || 'user'}_${idx}`}
                  style={[styles.taggedPeopleLink, { color: text }]}
                  onPress={() => openTaggedUserProfile(clean)}
                  suppressHighlighting
                >
                  {label}
                </Text>
              );
            })}
            {openingTaggedProfile ? (
              <Text style={styles.taggedPeopleLoading}></Text>
            ) : null}
          </Text>
        </View>
      )}
      <View style={styles.captionSection}>
        <Text style={[styles.captionLabel, textStyle]}>{t('postEditor.captionLabel')}</Text>
        <TextInput
          ref={captionInputRef}
          style={[styles.captionInput, bgStyle, { borderColor: border, color: text }]}
          placeholder={t('postEditor.captionPlaceholder')}
          value={caption}
          onChangeText={setCaption}
          multiline
          textAlignVertical="top"
          placeholderTextColor={mutedText}
          onFocus={() => {
            if (Platform.OS === 'ios') {
              iosFocusedFieldRef.current = captionInputRef;
              scrollIosFieldIntoView(captionInputRef);
            }
          }}
        />
      </View>

      {postType == 'crowdfunding' && (
        <View style={[styles.captionSection, { marginTop: -5 }]}>
          <Text style={[styles.captionLabel, textStyle]}>{t('postEditor.linkLabel')}</Text>
          <TextInput
            ref={linkInputRef}
            style={[styles.linkInput, bgStyle, { borderColor: border, color: text }]}
            placeholder={t('postEditor.linkPlaceholder')}
            value={link}
            onChangeText={setLink}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={mutedText}
            onFocus={() => {
              if (Platform.OS === 'ios') {
                iosFocusedFieldRef.current = linkInputRef;
                scrollIosFieldIntoView(linkInputRef);
              }
            }}
          />
        </View>
      )}
      {fromIcon !== 'Flips' && (

        <View style={styles.communityTrustSection}>
          <View style={[styles.communityTrustCard, cardStyle, { borderColor: border }]}>
            <View style={[styles.communityTrustIconWrap, { backgroundColor: `${accent}18` }]}>
              <Icon name="shield-checkmark" size={22} color={accent} />
            </View>
            <View style={styles.communityTrustCopy}>
              <View style={styles.communityTrustTitleRow}>
                <Text style={[styles.communityTrustTitle, textStyle]}>
                  {t('postEditor.communityTrustTitle')}
                </Text>
                {/* <Icon name="information-circle-outline" size={14} color="#6b7280" /> */}
              </View>
              <Text style={[styles.communityTrustSubtitle, { color: mutedText }]}>
                {t('postEditor.communityTrustSubtitle')}
              </Text>
              {/* <TouchableOpacity activeOpacity={0.75} style={styles.communityTrustLink}>
              <Text style={[styles.communityTrustLinkText, { color: text }]}>
                {t('postEditor.communityTrustLearnMore')}
              </Text>
              <Icon name="chevron-forward" size={11} color={text} />
            </TouchableOpacity> */}
            </View>
            <Switch
              value={isCommunityTrustPost}
              onValueChange={setIsCommunityTrustPost}
              trackColor={{ false: '#d1d5db', true: `${accent}66` }}
              thumbColor={isCommunityTrustPost ? accent : '#f8fafc'}
              ios_backgroundColor="#d1d5db"
            />
          </View>
        </View>
      )}
      <View style={styles.footer}>
        <CustomButton
          title={
            isEditingPost
              ? t('postEditor.saveChanges')
              : t('postEditor.continueButton')
          }
          onPress={handlePost}
          style={[
            styles.socialBtn,
            styles.instagramBtn,
            { backgroundColor: accent, bordercolor: accent },
          ]}
          textStyle={styles.socialBtnText}
        />
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.container, bgStyle]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, bgStyle]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={icon} />
        </TouchableOpacity>
        <Text style={[styles.title, textStyle]}>
          {isEditingPost
            ? t('postEditor.editPost')
            : fromIcon == 'Flips'
              ? t('postEditor.newFlip')
              : t('postEditor.newPost')}
        </Text>
        <Text></Text>
      </View>

      {Platform.OS === 'ios' ? (
        <ScrollView
          ref={iosScrollRef}
          style={[styles.content, bgStyle]}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: Math.max(40, 32 + iosKeyboardInset) },
          ]}
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
        >
          {renderEditorBody()}
        </ScrollView>
      ) : (
        <KeyboardAwareScrollView
          style={[styles.content, bgStyle]}
          contentContainerStyle={styles.contentContainer}
          enableOnAndroid
          enableAutomaticScroll
          extraScrollHeight={24}
          extraHeight={160}
          keyboardOpeningTime={120}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          enableResetScrollToCoords={false}
          showsVerticalScrollIndicator={false}
        >
          {renderEditorBody()}
        </KeyboardAwareScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  title: { fontSize: 18, fontWeight: '600', color: '#000', textAlign: 'center' },
  shareButton: { paddingHorizontal: 8, paddingVertical: 4 },
  postBtn: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  content: { flex: 1 },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  mediaPreviewSection: {
    marginHorizontal: MEDIA_PREVIEW_MARGIN,
    marginTop: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  mediaPreviewScrollContent: {
    alignItems: 'center',
    paddingRight: MEDIA_PREVIEW_MARGIN,
  },
  mediaPreviewCard: {
    width: IMAGE_PREVIEW_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    // backgroundColor: '#000',
    marginRight: 12,
    // elevation: 2,
    // shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mediaPreviewFill: {
    ...StyleSheet.absoluteFillObject,
  },
  removeDrawingBtn: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 6,
  },
  removeDrawingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoDurationText: {
    color: '#fff',
    fontSize: 11,
    marginLeft: 3,
    fontWeight: '600',
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6
  },
  filterBadgeText: { color: '#fff', fontSize: 8, fontWeight: '500' },
  overlayIndicators: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row'
  },
  indicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4
  },
  indicatorText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
  captionSection: { paddingHorizontal: 16, marginBottom: 20 },
  captionLabel: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#000' },
  taggedPeopleText: {
    fontSize: 14,
    color: '#000',
    paddingVertical: 6,
  },
  taggedPeopleLink: {
    color: '#5a2d82',
    fontWeight: '600',
  },
  taggedPeopleLoading: {
    color: '#777',
    fontSize: 12,
  },
  captionInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    fontSize: 16,
    color: '#000'
  },
  linkInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000'
  },
  communityTrustSection: {
    paddingHorizontal: 16,
    // marginTop: -6,
    marginBottom: '5%',
  },
  communityTrustCard: {
    minHeight: 85,
    borderWidth: 1,
    borderColor: '#eadff2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  communityTrustIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  communityTrustCopy: {
    flex: 1,
    paddingRight: 8,
  },
  communityTrustTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  communityTrustTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginRight: 6,
  },
  communityTrustSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 13,
    color: '#6b7280',
  },
  communityTrustLink: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  communityTrustLinkText: {
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    paddingTop: 6,
    paddingBottom: 10,
    alignItems: 'center',
  },
  instagramBtn: {
    color: '#fff',
    marginLeft: 20
  },
  socialBtn: {
    width: '90%',
    height: 45,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    bottom: 10,
  },
  socialBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PostEditorScreen;
