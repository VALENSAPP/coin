import React, { useEffect, useState, useCallback, useRef } from 'react';
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
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { StackActions, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomButton from '../../../components/customButton/customButton';
import { useToast } from 'react-native-toast-notifications';
import { createPost } from '../../../services/post';
import { getAllUser } from '../../../services/users';
import {
  buildPostMetaFromImages,
  buildCreatePostMusicPayload,
} from '../../../utils/postSoundtracks';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../../theme/useApptheme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const HEADER_HEIGHT = 56;
const IMAGE_PREVIEW_MAX_HEIGHT =
  Platform.OS === 'ios' ? Math.min(screenHeight * 0.48, 420) : screenHeight * 0.6;

const PostEditorScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const returnTo = route?.params?.returnTo || route?.params?.params?.returnTo;

  const navigateAfterPostCreated = useCallback(() => {
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
  }, [navigation, returnTo]);
  const {
    images = [],
    currentFilter = 'none',
    metadata = {},
    imageEdits,
    postType,
    fromIcon,
    taggedPeople = [],
    taggedPeopleIds = [],
    taggedPeopleMeta = [],
  } = route.params || {};
  const [editorImages, setEditorImages] = useState(images);
  const [caption, setCaption] = useState('');
  const [link, setLink] = useState('');
  const [profile, setProfile] = useState(null);
  const [openingTaggedProfile, setOpeningTaggedProfile] = useState(false);
  const [iosKeyboardInset, setIosKeyboardInset] = useState(0);
  const iosScrollRef = useRef(null);
  const captionInputRef = useRef(null);
  const linkInputRef = useRef(null);
  const iosFocusedFieldRef = useRef(null);
  const { bgStyle, textStyle, text } = useAppTheme();
console.log(taggedPeopleIds,'dtaatataatatin tah id')
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

  const handlePost = async () => {
    if (postType == 'crowdfunding') {
      if (link && !isValidLink(link)) {
        showToastMessage(toast, 'danger', 'Please enter a valid link starting with http:// or https://');
        return;
      }

      navigation.navigate('CreateMission', {
        images: editorImages,
        caption,
        link,
        taggedPeople,
        taggedPeopleIds,
        taggedPeopleMeta,
      });
      return;
    }

    dispatch(showLoader());
    const payload = { 
      caption: caption.trim(),
      taggedPeople:taggedPeopleIds ,
      // Array.isArray(taggedPeople) ? taggedPeople.join(', ') : taggedPeople,
      // ...(Array.isArray(taggedPeopleIds) && taggedPeopleIds.length ? { taggedPeopleIds } : {}),
      // ...(Array.isArray(taggedPeopleMeta) && taggedPeopleMeta.length ? { taggedPeopleMeta } : {}),
      media: editorImages.map(img => ({
        uri: getMediaUri(img),
        type: img.type,
        name: getMediaUri(img).split('/').pop()

      })),
      type:
        //  fromIcon === 'Flips'
        //   ? 'reel'
        //   : 
        postType === 'private'
          ? 'private'
          : 'normal' 
          ||fromIcon === 'Flips'
           ? 'reel'
           : 'normal'
          ,
    };

    const postMeta = buildPostMetaFromImages(editorImages);
    const { music, youtubeMusicMeta } = buildCreatePostMusicPayload(editorImages);

    try {
      const response = await createPost({
        ...payload,
        postMeta,
        ...(music ? { music } : {}),
        ...(youtubeMusicMeta ? { youtubeMusicMeta } : {}),
      });
      console.log('Post creation response:', response);

      if (response.statusCode == 200) {
        showToastMessage(toast, 'success', 'Post created successfully');
        navigateAfterPostCreated();
      } else {
        showToastMessage(toast, 'danger', response.message || 'Please try again');
      }
    } catch (err) {
      console.error('Post creation error:', err);
      showToastMessage(toast, 'danger', err?.response?.message || 'Something went wrong');
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
        showToastMessage(toast, 'danger', 'Unable to open this user profile.');
        return;
      }

      // UsersProfile is inside HomeMain stack. Pass returnTo so the back arrow can return here.
      navigation.navigate('HomeMain', {
        screen: 'UsersProfile',
        params: {
          userId: String(resolvedUserId),
          params: {
            returnTo: { tab: 'Add' },
          },
        },
      });
    } finally {
      setOpeningTaggedProfile(false);
    }
  }, [navigation, resolveUserIdFromUsername, toast]);

  const renderEditorBody = () => (
    <>
      {editorImages.length > 0 && (
        <View style={[styles.imagesCard, bgStyle]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imagesContainer}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          >
            {editorImages.map((img, idx) => (
              <View key={getMediaKey(img, idx)} style={styles.imageThumbWrapper}>
                {isMediaVideo(img) ? (
                  <View style={styles.videoThumbContainer}>
                    <Video
                      source={{ uri: getMediaUri(img) }}
                      style={styles.imageThumb}
                      resizeMode="contain"
                      paused={true}
                      muted={true}
                      controls={false}
                      poster={getVideoPosterUri(img) || undefined}
                    />
                    <View style={styles.videoBadge}>
                      <Icon name="play" size={14} color="#fff" />
                    </View>
                  </View>
                ) : (
                  <Image
                    source={{ uri: getMediaUri(img) }}
                    style={styles.imageThumb}
                    resizeMode="contain"
                  />
                )}
                {!isMediaVideo(img) && img.drawings && img.uriBeforeAnyDrawing && (
                  <TouchableOpacity
                    style={styles.removeDrawingBtn}
                    onPress={() => removeDrawingFromImage(idx)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.removeDrawingText, { color: text }]}>Remove drawing</Text>
                  </TouchableOpacity>
                )}
                {img.appliedFilter && img.appliedFilter !== 'none' && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{img.filterName}</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {Array.isArray(taggedPeople) && taggedPeople.length > 0 && (
        <View style={styles.captionSection}>
          <Text style={styles.captionLabel}>Tagged people</Text>
          <Text style={styles.taggedPeopleText}>
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
        <Text style={styles.captionLabel}>Write a caption (optional)</Text>
        <TextInput
          ref={captionInputRef}
          style={[styles.captionInput, bgStyle]}
          placeholder="Write a caption (optional)"
          value={caption}
          onChangeText={setCaption}
          multiline
          textAlignVertical="top"
          placeholderTextColor={'#e0e0e0'}
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
          <Text style={styles.captionLabel}>Add a link (optional)</Text>
          <TextInput
            ref={linkInputRef}
            style={[styles.linkInput, bgStyle]}
            placeholder="https://example.com"
            value={link}
            onChangeText={setLink}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={'#e0e0e0'}
            onFocus={() => {
              if (Platform.OS === 'ios') {
                iosFocusedFieldRef.current = linkInputRef;
                scrollIosFieldIntoView(linkInputRef);
              }
            }}
          />
        </View>
      )}

      <View style={styles.footer}>
        <CustomButton
          title="Continue"
          onPress={handlePost}
          style={[
            styles.socialBtn,
            styles.instagramBtn,
            { backgroundColor: text, bordercolor: text },
          ]}
          textStyle={styles.socialBtnText}
        />
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.container, bgStyle]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>{fromIcon == 'Flips' ? 'New Flip' : 'New Post'}</Text>
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
  imagesCard: {
    margin: 16,
    borderRadius: 12,
    height: Platform.OS === 'ios' ? IMAGE_PREVIEW_MAX_HEIGHT : screenHeight * 0.6,
  },
  imagesContainer: {
    paddingVertical: 20,
    paddingHorizontal: 10
  },
  imageThumbWrapper: {
    marginRight: 12,
    position: 'relative',
    alignItems: 'center',
  },
  removeDrawingBtn: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  removeDrawingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  imageThumb: {
    width: screenWidth * .85,
    // height: screenHeight * 0.6,
    borderRadius: 10,
    aspectRatio: 0.6,
    marginHorizontal: 6,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 4 },
    // shadowOpacity: 0.25,
    // shadowRadius: 6,
    // elevation: 6,
    // backgroundColor: '#fff', //
  },
  videoThumbContainer: {
    position: 'relative',
  },
  videoBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
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
