import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { pick, types as documentTypes } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useBusinessProfileTheme } from '../../theme/useBusinessProfileTheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { createPost, getMyEbookLibrary, createMarketplaceEbook, getPurchasedEbooks } from '../../services/post';
import { getMyClosetById } from '../../services/myCloset';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import RNFS from 'react-native-fs';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withAlpha } from '../../utils/closetTheme';
import { useTargetClosetScreen, navigateToTargetClosetScreen } from '../../utils/closetNavigation';

const MAX_PDF_SIZE_BYTES = 100 * 1024 * 1024;

const isLightColor = (hex) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return false;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 186;
};

const contrastOn = (background) => (isLightColor(background) ? '#111111' : '#ffffff');

const createChapter = (title, index) => ({
  id: `${Date.now()}-${index}`,
  title,
});

const getFileSizeLabel = (size) => {
  if (!size && size !== 0) return 'Unknown size';
  const mb = size / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  return `${(size / 1024).toFixed(0)} KB`;
};

const formatDisplayName = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const normalizePickerUri = (uri) => {
  if (!uri) return uri;

  const withoutScheme = String(uri).replace(/^file:\/\//, '');
  if (Platform.OS !== 'ios') {
    return withoutScheme;
  }

  try {
    return decodeURI(withoutScheme);
  } catch (error) {
    return withoutScheme;
  }
};

const getLibraryCoverImage = (item) => {
  if (!item) return null;
  const img = item.images?.[0] || item.image || item.thumbnail || item.coverImage || item.cover;
  if (typeof img === 'string' && img && !/\.pdf(\?|$)/i.test(img)) return img;
  if (img?.uri && !/\.pdf(\?|$)/i.test(img.uri)) return img.uri;
  if (img?.url && !/\.pdf(\?|$)/i.test(img.url)) return img.url;
  return null;
};

const EbookPublisher = ({ navigation }) => {
  // Follow wallet screens: theme from logged-in profile (user purple / company gold)
  const { bgStyle, cardStyle, textStyle, text, card, border, mutedText, icon, accent } =
    useBusinessProfileTheme();
  const { isDarkMode } = useThemeContext();
  const palette = useMemo(
    () => ({
      isDarkMode,
      card,
      border,
      mutedText,
      text,
      icon,
      accent,
      onAccent: contrastOn(accent),
      // Slightly elevated surface for inner panels (upload area, info box, etc.)
      surface: isDarkMode ? '#242424' : '#F8FAFC',
      surfaceAlt: isDarkMode ? '#1A1A1A' : '#F9FAFB',
      infoSurface: isDarkMode ? '#242424' : '#EEF2FF',
      // Neutral foreground text (kept brand-neutral so body copy stays readable)
      foreground: isDarkMode ? '#F3F4F6' : '#111827',
      foregroundSoft: isDarkMode ? '#D1D5DB' : '#374151',
      placeholder: isDarkMode ? '#8A8A8A' : '#9CA3AF',
      errorSurface: isDarkMode ? withAlpha('#DC2626', 0.18) : '#FEE2E2',
      errorRed: '#DC2626',
      successSurface: isDarkMode ? withAlpha('#2FB344', 0.18) : '#E7F8EA',
      successGreen: '#2FB344',
      stepActiveText: contrastOn(accent),
      stepIdleBorder: isDarkMode ? 'rgba(255,255,255,0.45)' : border,
      switchTrackOff: isDarkMode ? '#444444' : '#D1D5DB',
    }),
    [isDarkMode, card, border, mutedText, text, icon, accent],
  );
  const { onAccent, stepActiveText, stepIdleBorder, switchTrackOff } = palette;
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { t } = useLanguage();
  const route = useRoute();
  const dispatch = useDispatch();
  const tf = (key, fallback) => {
    const value = t(key);
    return value === key || value == null || value === '' ? fallback : value;
  };
  const [step, setStep] = useState(1);
  const [stepOneTab, setStepOneTab] = useState('upload');
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [chapters, setChapters] = useState([]);
  const [chapterDraft, setChapterDraft] = useState('');
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [selectedCover, setSelectedCover] = useState('minimal');
  const [customCoverImage, setCustomCoverImage] = useState(null);
  const [allowDownload, setAllowDownload] = useState(false);
  const [amount, setAmount] = useState('0');
  const [promoCode, setPromoCode] = useState('');
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rootStep, setRootStep] = useState(1);
  const [libraryBooks, setLibraryBooks] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [closetId, setClosetId] = useState(null);
  const loggedInUserId = route?.params?.loggedInUserId;
  const fromRootNavigator = !!route?.params?.fromRootNavigator;
  const rootMode = fromRootNavigator;

  const progress = useMemo(() => Math.min(100, (step / 3) * 100), [step]);
  const coverOptions = useMemo(() => ([
     {
      id: 'sample1',
      title: tf('ebookPublisher.coverSample1', 'Vibrant Gradient'),
      subtitle: tf('ebookPublisher.coverSample1Subtitle', 'Modern mesh gradient'),
      accent: '#6D28D9',
      imageUri: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600',
    },
    {
      id: 'sample2',
      title: tf('ebookPublisher.coverSample2', 'Serene Landscape'),
      subtitle: tf('ebookPublisher.coverSample2Subtitle', 'Ocean sunset view'),
      accent: '#0F766E',
      imageUri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600',
    },
    {
      id: 'sample3',
      title: tf('ebookPublisher.coverSample3', 'Cosmic Night'),
      subtitle: tf('ebookPublisher.coverSample3Subtitle', 'A starry sky'),
      accent: '#92400E',
      imageUri: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=600',
    },
    { id: 'custom', title: tf('ebookPublisher.coverCustom', 'Custom'), subtitle: tf('ebookPublisher.coverCustomSubtitle', 'Your image from gallery'), accent: '#7C3AED' },
  ]), [t]);
  const selectedCoverInfo = coverOptions.find(item => item.id === selectedCover) || coverOptions[0];

  const chapterCount = chapters.length;

  useEffect(() => {
    const fetchLibrary = async () => {
      if (stepOneTab !== 'library') return;

      setLibraryLoading(true);
      setLibraryError('');

      try {
        const responses = [
          await getPurchasedEbooks(),
          await getMyEbookLibrary(),
        ];

        const extractBooks = (res) => {
          const payload =
            res?.data?.posts ||
            res?.data?.post ||
            res?.data?.data?.posts ||
            res?.data?.data?.post ||
            res?.ebooks ||
            res?.data?.ebooks ||
            res?.data ||
            res;
          const nextBooks = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.posts)
              ? payload.posts
              : Array.isArray(payload?.ebooks)
                ? payload.ebooks
                : [];
          return nextBooks;
        };

        const nextBooks = responses
          .map(extractBooks)
          .find((books) => Array.isArray(books) && books.length > 0) || [];

        setLibraryBooks(nextBooks);
      } catch (error) {
        setLibraryError(tf('ebookPublisher.libraryLoadFailed', 'We could not load your library right now.'));
      } finally {
        setLibraryLoading(false);
      }
    };

    fetchLibrary();
  }, [stepOneTab]);

  useEffect(() => {
    (async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('userId');
        const resolvedUserId = storedUserId ? String(storedUserId) : null;
        setCurrentUserId(resolvedUserId);

        if (resolvedUserId) {
          const byUserRes = await getMyClosetById({ userId: resolvedUserId });
          const closetData = byUserRes?.data ?? byUserRes;
          const closetRecord = closetData?.closetDetails || closetData;
          const resolvedClosetId = closetData?.closetId ?? closetRecord?.id ?? closetRecord?._id ?? null;
          setClosetId(resolvedClosetId);
          console.log('EbookPublisher loaded closetId:', resolvedClosetId);
        }
      } catch (error) {
        console.log('Failed to load current user id / closet details for ebook publisher', error);
      }
    })();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (!rootMode) return undefined;

      setIsPublished(false);
      setRootStep(1);
      setSelectedPdf(null);
      setTitle('');
      setDescription('');
      setChapters([]);
      setChapterDraft('');
      setEditingChapterId(null);
      setPromoEnabled(false);
      setPromoCode('');
      setAmount('19.99');

      return undefined;
    }, [rootMode]),
  );

  useFocusEffect(
    React.useCallback(() => {
      if (!rootMode) return undefined;

      setIsPublished(false);
      setAmount(prev => (prev && prev !== '0' ? prev : '19.99'));

      return undefined;
    }, [rootMode]),
  );

  const filteredLibraryBooks = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    if (!query) return libraryBooks;

    return libraryBooks.filter((item) => {
      const title = String(item?.caption || item?.title || item?.ebookTitle || '').toLowerCase();
      const author = String(item?.userName || item?.author || item?.displayName || '').toLowerCase();
      const category = String(item?.category || item?.genre || item?.type || '').toLowerCase();
      const description = String(item?.description || '').toLowerCase();
      return title.includes(query) || author.includes(query) || category.includes(query) || description.includes(query);
    });
  }, [libraryBooks, librarySearch]);

  const handleOpenLibraryEbook = (item) => {
    const params = {
      ebook: item,
      userData: route?.params?.userData,
      loggedInUserId: loggedInUserId || currentUserId,
      fromRootNavigator: fromRootNavigator,
      fromEbookPublisher: true,
      username: item?.userName || route?.params?.userData?.userName || route?.params?.userData?.username
    };

    navigation?.navigate?.('ProfileMain', {
      screen: 'EbookDetail',
      params,
    });
  };

  const handlePickPdf = async () => {
    try {
      const files = await pick({
        type: [documentTypes.pdf],
        mode: 'import',
        presentationStyle: Platform.OS === 'ios' ? 'fullScreen' : undefined,
      });
      const file = Array.isArray(files) ? files[0] : files;
      const uri = file?.fileCopyUri || file?.uri;
      const size = Number(file?.size || 0);
      const normalizedUri = Platform.OS === 'ios' && uri && !String(uri).startsWith('file://')
        ? `file://${uri}`
        : uri;

      if (!normalizedUri) {
        Alert.alert(t('ebookPublisher.uploadFailedTitle'), t('ebookPublisher.uploadFailedMessage'));
        return;
      }

      if (size > MAX_PDF_SIZE_BYTES) {
        Alert.alert(t('ebookPublisher.sizeLimitTitle'), t('ebookPublisher.sizeLimitMessage'));
        return;
      }

      const nextFile = {
        name: file?.name || `ebook-${Date.now()}.pdf`,
        uri: normalizedUri,
        type: file?.type || 'application/pdf',
        size,
      };

      setSelectedPdf(nextFile);
      if (!title.trim()) {
        setTitle(nextFile.name.replace(/\.pdf$/i, ''));
      }
      setStep(2);
    } catch (error) {
      const code = String(error?.code || '').toUpperCase();
      if (code.includes('CANCEL')) return;
      Alert.alert(t('ebookPublisher.uploadFailedTitle'), t('ebookPublisher.uploadFailedMessage'));
    }
  };

  const handlePickCoverImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: false,
        quality: 0.85,
      });

      if (result?.didCancel) return;

      const asset = result?.assets?.[0];
      const uri = asset?.uri;

      if (!uri) {
        Alert.alert(
          tf('ebookPublisher.uploadFailedTitle', 'Upload failed'),
          tf('ebookPublisher.uploadFailedMessage', 'We could not read that image. Please try again.'),
        );
        return;
      }

      setCustomCoverImage({
        uri,
        name: asset?.fileName || 'cover-image.jpg',
      });
      setSelectedCover('custom');
    } catch (error) {
      Alert.alert(
        tf('ebookPublisher.uploadFailedTitle', 'Upload failed'),
        tf('ebookPublisher.uploadFailedMessage', 'We could not read that image. Please try again.'),
      );
    }
  };

  const handleAddOrUpdateChapter = () => {
    const nextTitle = chapterDraft.trim();
    if (!nextTitle) return;

    setChapters(prev => {
      if (editingChapterId) {
        return prev.map(item => (item.id === editingChapterId ? { ...item, title: nextTitle } : item));
      }

      return [...prev, createChapter(nextTitle, prev.length + 1)];
    });

    setChapterDraft('');
    setEditingChapterId(null);
  };

  const handleEditChapter = (chapter) => {
    setEditingChapterId(chapter.id);
    setChapterDraft(chapter.title);
  };

  const handleDeleteChapter = (chapterId) => {
    setChapters(prev => prev.filter(item => item.id !== chapterId));
    if (editingChapterId === chapterId) {
      setEditingChapterId(null);
      setChapterDraft('');
    }
  };

  const buildTextArray = (value) =>
    String(value || '')
      .split(/\r?\n+/)
      .map(item => item.trim())
      .filter(Boolean);

  const handlePublish = async () => {
    if (!selectedPdf?.uri) {
      Alert.alert(tf('ebookPublisher.uploadFailedTitle', 'Upload failed'), tf('ebookPublisher.uploadFailedMessage', 'Please choose a PDF first.'));
      return;
    }

    if (!title.trim()) {
      Alert.alert(tf('ebookPublisher.uploadFailedTitle', 'Upload failed'), tf('ebookPublisher.uploadFailedMessage', 'Please add an ebook title.'));
      return;
    }

    if (fromRootNavigator) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        Alert.alert(tf('ebookPublisher.uploadFailedTitle', 'Upload failed'), 'Price cannot be 0. Please enter a valid price.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      dispatch(showLoader());

      let coverSource = null;
      if (selectedCover === 'custom' && customCoverImage) {
        coverSource = customCoverImage;
      } else if (selectedCoverInfo && selectedCoverInfo.imageUri) {
        const localFileName = `sample-cover-${selectedCoverInfo.id}.jpg`;
        const localFilePath = `${RNFS.CachesDirectoryPath}/${localFileName}`;
        
        console.log('Downloading sample cover:', selectedCoverInfo.imageUri, 'to:', localFilePath);
        
        await RNFS.downloadFile({
          fromUrl: selectedCoverInfo.imageUri,
          toFile: localFilePath,
        }).promise;
        
        coverSource = {
          uri: `file://${localFilePath}`,
          name: localFileName,
          type: 'image/jpeg',
        };
      }

      let response;
      if (fromRootNavigator) {
        let finalClosetId = closetId;
        if (!finalClosetId) {
          const resolvedUserId = currentUserId || (await AsyncStorage.getItem('userId'));
          if (resolvedUserId) {
            const byUserRes = await getMyClosetById({ userId: String(resolvedUserId) });
            const closetData = byUserRes?.data ?? byUserRes;
            const closetRecord = closetData?.closetDetails || closetData;
            finalClosetId = closetData?.closetId ?? closetRecord?.id ?? closetRecord?._id ?? null;
          }
        }
        if (!finalClosetId) {
          Alert.alert(tf('ebookPublisher.uploadFailedTitle', 'Upload failed'), 'User closet profile not found. Please setup your closet first.');
          setIsSubmitting(false);
          dispatch(hideLoader());
          return;
        }

        const marketplacePayload = {
          closetId: finalClosetId,
          caption: title.trim(),
          text: buildTextArray(description),
          isDownload: allowDownload,
          images: coverSource ? [coverSource] : [],
          ebookpdf: selectedPdf,
          amount: Number(String(amount || '0')) || 0,
          promoCode: String(promoCode || '').trim(),
          tableContent: chapters.map(item => item.title),
        };
        console.log('Sending marketplace ebook payload:', marketplacePayload);
        response = await createMarketplaceEbook(marketplacePayload);
      } else {
        const payload = {
          type: 'private',
          format: 'ebook',
          caption: title.trim(),
          text: buildTextArray(description),
          allowDownload,
          images: coverSource ? [coverSource] : [],
          ebookpdf: selectedPdf,
          tableContent: chapters.map(item => item.title),
          amount: Number(String(amount || '0')) || 0,
          promoCode: String(promoCode || '').trim(),
          log: {
            createdAt: new Date().toISOString(),
            meta: {
              title: title.trim(),
              amount: Number(String(amount || '0')) || 0,
              promoCode: String(promoCode || '').trim(),
              chapters: chapters.length,
              allowDownload: !!allowDownload,
            },
          },
        };
        console.log('Sending standard post payload:', payload);
        response = await createPost(payload);
      }

      console.log('API Response:', response);
      const isSuccess = response?.status === 200 || response?.statusCode === 200 || response?.success === true;
      if (isSuccess) {
        console.log('✅ Ebook published successfully');
        if (fromRootNavigator) {
          setIsPublished(true);
        } else {
          navigation.goBack?.();
        }
      }

    } catch (error) {
      console.log('❌ API Error:', error);
      console.log('❌ Error Response:', error?.response);
      console.log('❌ Error Status:', error?.response?.status);
      console.log('❌ Error Data:', error?.response?.data);

      Alert.alert(
        tf('ebookPublisher.uploadFailedTitle', 'Upload failed'),
        error?.response?.data?.message ||
        error?.message ||
        tf('ebookPublisher.uploadFailedMessage', 'Please try again.'),
      );
    } finally {
      dispatch(hideLoader());
      setIsSubmitting(false);
    }
  };

  const stepInfo = [
    { key: 1, label: t('ebookPublisher.stepUpload') },
    { key: 2, label: t('ebookPublisher.stepCustomize') },
    { key: 3, label: t('ebookPublisher.stepReview') },
  ];

  const rootSteps = [
    { key: 1, label: 'Upload', done: rootStep > 1 || isPublished, active: rootStep === 1 && !isPublished },
    { key: 2, label: 'Details', done: rootStep > 2 || isPublished, active: rootStep === 2 && !isPublished },
    { key: 3, label: 'Pricing', done: rootStep > 3 || isPublished, active: rootStep === 3 && !isPublished },
    { key: 4, label: 'Publish', active: isPublished },
  ];

  const earningsAmount = Number(String(amount || '0')) || 0;
  const platformFee = rootMode ? earningsAmount * 0.1 : 0;
  const sellerEarnings = rootMode ? Math.max(0, earningsAmount - platformFee) : 0;
  const targetScreen = useTargetClosetScreen();
  const handleGoToCloset = () => {
    navigateToTargetClosetScreen(navigation, targetScreen);
  };

  const renderUploadAndDetailsBlock = () => (
    <>
      <View style={styles.topToggle}>
        <TouchableOpacity
          onPress={() => setStepOneTab('upload')}
          style={[styles.topToggleButton, stepOneTab === 'upload' && { backgroundColor: accent }]}
          activeOpacity={0.85}
        >
          <Ionicons name="cloud-upload-outline" size={16} color={stepOneTab === 'upload' ? onAccent : text} />
          <Text style={[styles.topToggleText, stepOneTab === 'upload' && styles.topToggleTextActive]}>
            {tf('ebookPublisher.uploadMyBook', 'Upload My Book')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setStepOneTab('library')}
          style={[styles.topToggleButton, stepOneTab === 'library' && { backgroundColor: accent }]}
          activeOpacity={0.85}
        >
          <Ionicons name="book-outline" size={16} color={stepOneTab === 'library' ? onAccent : text} />
          <Text style={[styles.topToggleText, stepOneTab === 'library' && styles.topToggleTextActive]}>
            {tf('ebookPublisher.myLibrary', 'My Library')}
          </Text>
        </TouchableOpacity>
      </View>

      {stepOneTab === 'upload' ? (
        <>
          <TouchableOpacity style={[styles.uploadArea, { borderColor: text }]} onPress={handlePickPdf}>
            <Ionicons name="cloud-upload-outline" size={44} color={text} />
            <Text style={styles.uploadPrimary}>{t('ebookPublisher.dragDrop')}</Text>
            <Text style={styles.uploadSecondary}>{t('ebookPublisher.or')}</Text>
            <View style={[styles.uploadButton, { backgroundColor: accent }]}>
              <Text style={styles.uploadButtonText}>{t('ebookPublisher.choosePdf')}</Text>
            </View>
            <Text style={styles.limitText}>{t('ebookPublisher.maxLimit')}</Text>
          </TouchableOpacity>

          {selectedPdf && (
            <View style={styles.fileRow}>
              <View style={styles.fileBadge}>
                <Text style={styles.fileBadgeText}>PDF</Text>
              </View>
              <View style={styles.fileMeta}>
                <Text style={[styles.fileName, textStyle]} numberOfLines={1}>
                  {selectedPdf.name}
                </Text>
                <Text style={styles.fileSize}>{getFileSizeLabel(selectedPdf.size)}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
            </View>
          )}

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={text} />
            <Text style={styles.infoText}>{t('ebookPublisher.pdfHelp')}</Text>
          </View>
        </>
      ) : (
        <View style={styles.libraryPanel}>
          <Text style={[styles.libraryTitle, textStyle]}>My Library</Text>
          <Text style={styles.sectionText}>E-books you&apos;ve purchased from creators on Valens.</Text>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={mutedText} />
            <TextInput
              value={librarySearch}
              onChangeText={setLibrarySearch}
              placeholder="Search your library"
              placeholderTextColor={mutedText}
              style={styles.searchInput}
              returnKeyType="search"
            />
            <Ionicons name="options-outline" size={16} color={mutedText} />
          </View>

          {libraryLoading ? (
            <Text style={styles.libraryStateText}>{tf('myClosetBuyer.loading', 'Loading...')}</Text>
          ) : libraryError ? (
            <Text style={styles.libraryStateText}>{libraryError}</Text>
          ) : filteredLibraryBooks.length === 0 ? (
            <Text style={styles.libraryStateText}>
              {librarySearch.trim()
                ? tf('ebookPublisher.noLibraryMatches', 'No e-books match your search.')
                : tf('ebookPublisher.noLibraryItems', 'No purchased e-books found yet.')}
            </Text>
          ) : (
            filteredLibraryBooks.map(item => {
              const libraryTitle = item?.caption || item?.title || item?.ebookTitle || 'Untitled e-book';
              const libraryAuthor = formatDisplayName(item?.purchasedFrom || item?.userName || item?.author || item?.displayName || 'Unknown Author');
              const coverLabel = String(libraryTitle).slice(0, 2).toUpperCase();
              const coverImage = getLibraryCoverImage(item);
              // Never fall back to `text` — in user dark mode text is white and covers become blank.
              const tint = item?.themeColor || item?.color || accent;

              return (
                <TouchableOpacity
                  key={String(item?.id || item?._id || libraryTitle)}
                  activeOpacity={0.85}
                  style={styles.libraryItem}
                  onPress={() => handleOpenLibraryEbook(item)}
                >
                  <View style={[styles.libraryCover, { backgroundColor: tint }]}>
                    {coverImage ? (
                      <Image source={{ uri: coverImage }} style={styles.libraryCoverImage} resizeMode="cover" />
                    ) : (
                      <Text style={styles.libraryCoverText}>{coverLabel}</Text>
                    )}
                  </View>
                  <View style={styles.libraryMeta}>
                    <Text style={styles.libraryItemTitle} numberOfLines={1}>{libraryTitle}</Text>
                    <Text style={styles.libraryItemSubtitle}>by {libraryAuthor}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={mutedText} />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </>
  );

  const renderRootMode = () => {
    if (isPublished) {
      return (
        <View style={[styles.rootSuccessCard, cardStyle]}>
          <View style={styles.successConfetti}>
            <View style={[styles.confettiDot, styles.confettiDotA]} />
            <View style={[styles.confettiDot, styles.confettiDotB]} />
            <View style={[styles.confettiDot, styles.confettiDotC]} />
            <View style={[styles.confettiDot, styles.confettiDotD]} />
          </View>

          <View style={styles.successBadge}>
            <Ionicons name="checkmark" size={42} color={palette.successGreen} />
          </View>

          <Text style={[styles.successTitle, textStyle]}>Congratulations!</Text>
          <Text style={styles.successSubtitle}>Your e-book has been published successfully.</Text>

          <View style={styles.successBookCard}>
            <View style={styles.successBookCover}>
              {selectedCoverInfo.imageUri || (selectedCover === 'custom' && customCoverImage) ? (
                <Image
                  source={{ uri: selectedCoverInfo.imageUri || customCoverImage?.uri }}
                  style={styles.successBookCoverImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.successBookCoverFallback, { backgroundColor: selectedCoverInfo.accent }]}>
                  <Text style={styles.successBookCoverFallbackText}>DIGITAL CREATOR</Text>
                </View>
              )}
            </View>

            <View style={styles.successBookMeta}>
              <Text style={styles.successBookTitle} numberOfLines={2}>{title || 'The Digital Creator'}</Text>
              <Text style={styles.successBookPrice}>${earningsAmount ? earningsAmount.toFixed(2) : '19.99'}</Text>
              <View style={styles.publishedPill}>
                <Text style={styles.publishedPillText}>Published</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.goClosetButton, { backgroundColor: accent }]}
            onPress={handleGoToCloset}
            activeOpacity={0.85}
          >
            <Text style={styles.goClosetButtonText}>Go to Closet</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (rootStep === 1) {
      return (
        <View style={[styles.card, cardStyle]}>
          <Text style={[styles.sectionTitle, textStyle]}>{t('ebookPublisher.uploadTitle')}</Text>
          <Text style={styles.sectionText}>{t('ebookPublisher.uploadHint')}</Text>
          {renderUploadAndDetailsBlock()}

          {stepOneTab === 'upload' && (
            <View style={styles.footerActions}>
              <TouchableOpacity
                style={[styles.footerButton, styles.footerButtonPrimary, { backgroundColor: accent }]}
                onPress={() => setRootStep(2)}
              >
                <Text style={styles.footerButtonPrimaryText}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }

    if (rootStep === 2) {
      return (
        <View style={[styles.card, cardStyle]}>
          <Text style={[styles.sectionTitle, textStyle]}>{tf('ebookPublisher.customizeTitle', 'Customize E-book')}</Text>
          <Text style={styles.sectionText}>{tf('ebookPublisher.customizeHint', 'Select a cover, edit details, and build your table of contents.')}</Text>

          <Text style={styles.fieldLabel}>1. {tf('ebookPublisher.coverLabel', 'Choose Cover')}</Text>
          <Text style={styles.helperText}>Select a cover for your e-book.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coverRow}>
            {coverOptions.map(option => {
              const selected = option.id === selectedCover;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.coverCard, selected && { borderColor: text }]}
                  onPress={() => setSelectedCover(option.id)}
                >
                  <View
                    style={[
                      styles.coverPreview,
                      option.imageUri || (option.id === 'custom' && customCoverImage)
                        ? styles.coverPreviewCustom
                        : { backgroundColor: option.accent },
                    ]}
                  >
                    {option.imageUri ? (
                      <Image source={{ uri: option.imageUri }} style={styles.customCoverImage} resizeMode="cover" />
                    ) : option.id === 'custom' && customCoverImage ? (
                      <Image source={{ uri: customCoverImage.uri }} style={styles.customCoverImage} resizeMode="cover" />
                    ) : null}
                  </View>
                  <Text style={styles.coverTitle}>{option.title}</Text>
                  <Text style={styles.coverSubtitle}>{option.subtitle}</Text>
                  {selected && <Text style={[styles.coverSelected, { color: text }]}>{t('ebookPublisher.selected')}</Text>}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={[styles.coverCard, styles.uploadCoverCard, { borderColor: text }]} onPress={handlePickCoverImage}>
              <Ionicons name="add" size={24} color={text} />
              <Text style={styles.coverTitle}>{tf('ebookPublisher.uploadNew', 'Add Cover')}</Text>
              <Text style={styles.coverSubtitle}>{tf('ebookPublisher.coverReplace', 'Choose a cover image from gallery')}</Text>
            </TouchableOpacity>
          </ScrollView>

          <Text style={styles.fieldLabel}>2. E-book Title & Description</Text>
          <Text style={styles.helperText}>Title</Text>
          <View style={styles.inputLike}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={[styles.inputText, styles.inputField]}
              placeholder="Enter ebook title"
              placeholderTextColor={mutedText}
            />
          </View>

          <Text style={styles.helperText}>Description</Text>
          <View style={styles.textAreaLike}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.inputText, styles.textAreaField]}
              placeholder="Add each description line on a new row"
              placeholderTextColor={mutedText}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Text style={styles.fieldLabel}>3. Table of Contents</Text>
          <Text style={styles.helperText}>Add chapter titles to send `tableContent`.</Text>

          <View style={styles.chapterList}>
            {chapters.length === 0 ? (
              <Text style={styles.emptyChaptersText}>No chapters added yet.</Text>
            ) : (
              chapters.map((chapter, index) => (
                <View key={chapter.id} style={styles.chapterRow}>
                  <Ionicons name="reorder-three-outline" size={22} color={mutedText} />
                  <Text style={styles.chapterText}>{index + 1}. {chapter.title}</Text>
                  <TouchableOpacity onPress={() => handleEditChapter(chapter)} style={styles.chapterAction}>
                    <Ionicons name="pencil-outline" size={18} color={mutedText} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteChapter(chapter.id)} style={styles.chapterAction}>
                    <Ionicons name="trash-outline" size={18} color={mutedText} />
                  </TouchableOpacity>
                </View>
              ))
            )}

            <View style={styles.chapterEditor}>
              <TextInput
                value={chapterDraft}
                onChangeText={setChapterDraft}
                style={styles.chapterInput}
                placeholder={editingChapterId ? 'Edit chapter title' : 'New chapter title'}
                placeholderTextColor={mutedText}
              />
              <TouchableOpacity style={[styles.addChapterButton, { borderColor: text }]} onPress={handleAddOrUpdateChapter}>
                <Text style={[styles.addChapterButtonText, { color: text }]}>
                  {editingChapterId ? 'Save Chapter' : 'Add Chapter'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footerActions}>
            <TouchableOpacity style={[styles.footerButton, { borderColor: text }]} onPress={() => setRootStep(1)}>
              <Text style={[styles.footerButtonText, { color: text }]}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerButton, styles.footerButtonPrimary, { backgroundColor: accent }]}
              onPress={() => setRootStep(3)}
            >
              <Text style={styles.footerButtonPrimaryText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.rootPricingWrap}>
        <Text style={[styles.rootSectionTitle, textStyle]}>Set Your Price</Text>
        <Text style={styles.rootSectionSubtitle}>Set a fair price for your e-book.</Text>

        <View style={[styles.rootCard, cardStyle]}>
          <Text style={[styles.rootCardTitle, textStyle]}>Price per Book</Text>
          <Text style={styles.rootCardBody}>This is the price customers will pay to purchase your e-book.</Text>

          <View style={[styles.rootPriceField, { borderColor: `${text}44` }]}>
            <Text style={styles.rootCurrency}>$</Text>
            <TextInput
              value={String(amount)}
              onChangeText={val => setAmount(val.replace(/[^0-9.]/g, ''))}
              style={[styles.rootPriceInput, textStyle]}
              placeholder="19.99"
              placeholderTextColor={mutedText}
              keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
            />
          </View>
          <Text style={styles.rootHint}>Suggested price range: $2.99 - $49.99</Text>
        </View>

        <View style={[styles.rootCard, cardStyle]}>
          <Text style={[styles.rootCardTitle, textStyle]}>You&apos;ll Earn</Text>
          <Text style={styles.rootCardBody}>Your earnings per sale after platform fee.</Text>

          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Price per Book</Text>
            <Text style={styles.earningsValue}>${earningsAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Platform Fee (10%)</Text>
            <Text style={styles.earningsValue}>-${platformFee.toFixed(2)}</Text>
          </View>

          <View style={styles.earningsDivider} />

          <View style={styles.earningsRow}>
            <Text style={[styles.earningsLabel, styles.earningsTotalLabel]}>You&apos;ll Earn</Text>
            <Text style={[styles.earningsValue, styles.earningsTotalValue]}>${sellerEarnings.toFixed(2)}</Text>
          </View>
        </View>

        <View style={[styles.rootCard, cardStyle]}>
          <View style={styles.promoRow}>
            <View style={styles.promoLeft}>
              <Text style={[styles.settingTitle, styles.rootPromoTitle]}>Add Promo Code (Optional)</Text>
              <Text style={styles.rootPromoSubtitle}>Create a discount code to promote your e-book</Text>
            </View>
            <View style={styles.promoRight}>
              <Switch
                value={promoEnabled}
                onValueChange={setPromoEnabled}
                trackColor={{ false: switchTrackOff, true: text }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {promoEnabled && (
            <View style={[styles.promoInputWrap, { borderColor: `${text}22` }]}>
              <TextInput
                value={promoCode}
                onChangeText={setPromoCode}
                style={[styles.inputText, styles.promoInput, { color: text }]}
                placeholder="Enter promo code"
                placeholderTextColor={`${text}66`}
                autoCapitalize="characters"
              />
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.rootPrimaryButton, { backgroundColor: accent, opacity: isSubmitting ? 0.75 : 1 }]}
          onPress={handlePublish}
          disabled={isSubmitting}
        >
          <Text style={styles.rootPrimaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.screen, bgStyle]}>
      <View style={[styles.header, cardStyle, rootMode && styles.rootHeader]}>
        <TouchableOpacity onPress={() => navigation.goBack?.()} style={styles.headerIconButton}>
          <Ionicons name="arrow-back" size={22} color={text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.title, textStyle]}>{rootMode ? 'Sell E-book' : t('ebookPublisher.title')}</Text>
          {!rootMode && <Text style={styles.subtitle}>{t('ebookPublisher.subtitle')}</Text>}
        </View>
        {rootMode ? (
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerIconButton}>
              <Ionicons name="information-circle-outline" size={22} color={text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconButton}>
              <Ionicons name="ellipsis-horizontal" size={22} color={text} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerIconButton} />
        )}
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, rootMode && styles.rootContent]}
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={24}
        extraHeight={Platform.OS === 'ios' ? 40 : 80}
      >
        {rootMode ? (
          <>
            <View style={styles.rootStepper}>
              {rootSteps.map((item, index) => {
                const active = item.active;
                const done = item.done;
                const isLast = index === rootSteps.length - 1;
                return (
                  <View key={item.key} style={styles.rootStepItem}>
                    <View style={styles.rootStepTopRow}>
                      <View style={[styles.rootStepCircle, (active || done) && { backgroundColor: accent, borderColor: accent }, !active && !done && { borderColor: stepIdleBorder }]}>
                        <Text style={[styles.rootStepCircleText, (active || done) && { color: stepActiveText }]}>
                          {done || active ? '✓' : item.key}
                        </Text>
                      </View>
                      {!isLast && <View style={[styles.rootStepLine, { backgroundColor: accent }]} />}
                    </View>
                    <Text style={[styles.rootStepLabel, (active || done) && { color: accent, fontWeight: '800' }]}>{item.label}</Text>
                  </View>
                );
              })}
            </View>

            {renderRootMode()}
          </>
        ) : (
          <>
            <View style={[styles.progressTrack, cardStyle]}>
              <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: accent }]} />
            </View>

            <View style={styles.stepRow}>
              {stepInfo.map(item => {
                const active = item.key === step;
                const done = item.key < step;
                return (
                  <View key={item.key} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepCircle,
                        { borderColor: active || done ? accent : stepIdleBorder },
                        (active || done) && { backgroundColor: accent },
                      ]}
                    >
                      <Text style={[styles.stepNumber, (active || done) && { color: stepActiveText }]}>
                        {done ? '✓' : item.key}
                      </Text>
                    </View>
                    <Text style={[styles.stepLabel, active && { color: text }]}>{item.label}</Text>
                  </View>
                );
              })}
            </View>

            {step === 1 && (
            <View style={[styles.card, cardStyle]}>
              <Text style={[styles.sectionTitle, textStyle]}>{t('ebookPublisher.uploadTitle')}</Text>
              <Text style={styles.sectionText}>{t('ebookPublisher.uploadHint')}</Text>

          <View style={styles.topToggle}>
            <TouchableOpacity
              onPress={() => setStepOneTab('upload')}
              style={[styles.topToggleButton, stepOneTab === 'upload' && { backgroundColor: accent }]}
              activeOpacity={0.85}
            >
              <Ionicons name="cloud-upload-outline" size={16} color={stepOneTab === 'upload' ? onAccent : text} />
              <Text style={[styles.topToggleText, stepOneTab === 'upload' && styles.topToggleTextActive]}>
                {tf('ebookPublisher.uploadMyBook', 'Upload My Book')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStepOneTab('library')}
              style={[styles.topToggleButton, stepOneTab === 'library' && { backgroundColor: accent }]}
              activeOpacity={0.85}
            >
              <Ionicons name="book-outline" size={16} color={stepOneTab === 'library' ? onAccent : text} />
              <Text style={[styles.topToggleText, stepOneTab === 'library' && styles.topToggleTextActive]}>
                {tf('ebookPublisher.myLibrary', 'My Library')}
              </Text>
            </TouchableOpacity>
          </View>

          {stepOneTab === 'upload' ? (
            <>
              <TouchableOpacity style={[styles.uploadArea, { borderColor: text }]} onPress={handlePickPdf}>
                <Ionicons name="cloud-upload-outline" size={44} color={text} />
                <Text style={styles.uploadPrimary}>{t('ebookPublisher.dragDrop')}</Text>
                <Text style={styles.uploadSecondary}>{t('ebookPublisher.or')}</Text>
                <View style={[styles.uploadButton, { backgroundColor: accent }]}>
                  <Text style={styles.uploadButtonText}>{t('ebookPublisher.choosePdf')}</Text>
                </View>
                <Text style={styles.limitText}>{t('ebookPublisher.maxLimit')}</Text>
              </TouchableOpacity>

              {selectedPdf && (
                <View style={styles.fileRow}>
                  <View style={styles.fileBadge}>
                    <Text style={styles.fileBadgeText}>PDF</Text>
                  </View>
                  <View style={styles.fileMeta}>
                    <Text style={[styles.fileName, textStyle]} numberOfLines={1}>
                      {selectedPdf.name}
                    </Text>
                    <Text style={styles.fileSize}>{getFileSizeLabel(selectedPdf.size)}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                </View>
              )}

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={18} color={text} />
                <Text style={styles.infoText}>{t('ebookPublisher.pdfHelp')}</Text>
              </View>
            </>
          ) : (
            <View style={styles.libraryPanel}>
              <Text style={[styles.libraryTitle, textStyle]}>My Library</Text>
              <Text style={styles.sectionText}>E-books you&apos;ve purchased from creators on Valens.</Text>

              <View style={styles.searchBar}>
                <Ionicons name="search" size={16} color={mutedText} />
                <TextInput
                  value={librarySearch}
                  onChangeText={setLibrarySearch}
                  placeholder="Search your library"
                  placeholderTextColor={mutedText}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                <Ionicons name="options-outline" size={16} color={mutedText} />
              </View>

              {libraryLoading ? (
                <Text style={styles.libraryStateText}>{tf('myClosetBuyer.loading', 'Loading...')}</Text>
              ) : libraryError ? (
                <Text style={styles.libraryStateText}>{libraryError}</Text>
              ) : filteredLibraryBooks.length === 0 ? (
                <Text style={styles.libraryStateText}>
                  {librarySearch.trim()
                    ? tf('ebookPublisher.noLibraryMatches', 'No e-books match your search.')
                    : tf('ebookPublisher.noLibraryItems', 'No purchased e-books found yet.')}
                </Text>
              ) : (
                filteredLibraryBooks.map(item => {
                  const libraryTitle = item?.caption || item?.title || item?.ebookTitle || 'Untitled e-book';
                  const libraryAuthor = formatDisplayName(item?.purchasedFrom || item?.userName || item?.author || item?.displayName || 'Unknown Author');
                  const libraryCategory = item?.category || item?.genre || item?.type || 'E-book';
                  const coverLabel = String(libraryTitle).slice(0, 2).toUpperCase();
                  const progress = Math.max(0, Math.min(Number(item?.progress ?? item?.readProgress ?? 0), 100));
                  const coverImage = getLibraryCoverImage(item);
                  // Never fall back to `text` — in user dark mode text is white and covers become blank.
                  const tint = item?.themeColor || item?.color || accent;

                  return (
                    <TouchableOpacity
                      key={String(item?.id || item?._id || libraryTitle)}
                      activeOpacity={0.85}
                      style={styles.libraryItem}
                      onPress={() => handleOpenLibraryEbook(item)}
                    >
                      <View style={[styles.libraryCover, { backgroundColor: tint }]}>
                        {coverImage ? (
                          <Image source={{ uri: coverImage }} style={styles.libraryCoverImage} resizeMode="cover" />
                        ) : (
                          <Text style={styles.libraryCoverText}>{coverLabel}</Text>
                        )}
                      </View>
                      <View style={styles.libraryMeta}>
                        <Text style={styles.libraryItemTitle} numberOfLines={1}>{libraryTitle}</Text>
                        <Text style={styles.libraryItemSubtitle}>by {libraryAuthor}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={mutedText} />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </View>
            )}

            {step === 2 && (
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionTitle, textStyle]}>{tf('ebookPublisher.customizeTitle', 'Customize E-book')}</Text>
            <Text style={styles.sectionText}>{tf('ebookPublisher.customizeHint', 'Select a cover, edit details, and build your table of contents.')}</Text>

            <Text style={styles.fieldLabel}>1. {tf('ebookPublisher.coverLabel', 'Choose Cover')}</Text>
            <Text style={styles.helperText}>Select a cover for your e-book.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coverRow}>
              {coverOptions.map(option => {
                const selected = option.id === selectedCover;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.coverCard, selected && { borderColor: text }]}
                    onPress={() => setSelectedCover(option.id)}
                  >
                    <View
                      style={[
                        styles.coverPreview,
                        option.imageUri || (option.id === 'custom' && customCoverImage)
                          ? styles.coverPreviewCustom
                          : { backgroundColor: option.accent },
                      ]}
                    >
                      {option.imageUri ? (
                        <Image source={{ uri: option.imageUri }} style={styles.customCoverImage} resizeMode="cover" />
                      ) : option.id === 'custom' && customCoverImage ? (
                        <Image source={{ uri: customCoverImage.uri }} style={styles.customCoverImage} resizeMode="cover" />
                      ) : null}
                    </View>
                    <Text style={styles.coverTitle}>{option.title}</Text>
                    <Text style={styles.coverSubtitle}>{option.subtitle}</Text>
                    {selected && <Text style={[styles.coverSelected, { color: text }]}>{t('ebookPublisher.selected')}</Text>}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity style={[styles.coverCard, styles.uploadCoverCard, { borderColor: text }]} onPress={handlePickCoverImage}>
                <Ionicons name="add" size={24} color={text} />
                <Text style={styles.coverTitle}>{tf('ebookPublisher.uploadNew', 'Add Cover')}</Text>
                <Text style={styles.coverSubtitle}>{tf('ebookPublisher.coverReplace', 'Choose a cover image from gallery')}</Text>
              </TouchableOpacity>
            </ScrollView>

            <Text style={styles.fieldLabel}>2. E-book Title & Description</Text>
            <Text style={styles.helperText}>Title</Text>
            <View style={styles.inputLike}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                style={[styles.inputText, styles.inputField]}
                placeholder="Enter ebook title"
                placeholderTextColor={mutedText}
              />
            </View>

            <Text style={styles.helperText}>Description</Text>
            <View style={styles.textAreaLike}>
              <TextInput
                value={description}
                onChangeText={setDescription}
                style={[styles.inputText, styles.textAreaField]}
                placeholder="Add each description line on a new row"
                placeholderTextColor={mutedText}
                multiline
                textAlignVertical="top"
              />
            </View>

            <Text style={styles.fieldLabel}>3. Table of Contents</Text>
            <Text style={styles.helperText}>Add chapter titles to send `tableContent`.</Text>

            <View style={styles.chapterList}>
              {chapters.length === 0 ? (
                <Text style={styles.emptyChaptersText}>No chapters added yet.</Text>
              ) : (
                chapters.map((chapter, index) => (
                  <View key={chapter.id} style={styles.chapterRow}>
                    <Ionicons name="reorder-three-outline" size={22} color={mutedText} />
                    <Text style={styles.chapterText}>{index + 1}. {chapter.title}</Text>
                    <TouchableOpacity onPress={() => handleEditChapter(chapter)} style={styles.chapterAction}>
                      <Ionicons name="pencil-outline" size={18} color={mutedText} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteChapter(chapter.id)} style={styles.chapterAction}>
                      <Ionicons name="trash-outline" size={18} color={mutedText} />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <View style={styles.chapterEditor}>
                <TextInput
                  value={chapterDraft}
                  onChangeText={setChapterDraft}
                  style={styles.chapterInput}
                  placeholder={editingChapterId ? 'Edit chapter title' : 'New chapter title'}
                  placeholderTextColor={mutedText}
                />
                <TouchableOpacity style={[styles.addChapterButton, { borderColor: text }]} onPress={handleAddOrUpdateChapter}>
                  <Text style={[styles.addChapterButtonText, { color: text }]}>
                    {editingChapterId ? 'Save Chapter' : 'Add Chapter'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
            )}

            {step === 3 && (
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionTitle, textStyle]}>{t('ebookPublisher.reviewTitle')}</Text>
            <Text style={styles.sectionText}>{t('ebookPublisher.reviewHint')}</Text>

            <View style={[styles.previewCard, { borderColor: text }]}>
              <View
                style={[
                  styles.previewCover,
                  selectedCoverInfo.imageUri
                    ? null
                    : selectedCover === 'custom' && customCoverImage
                    ? styles.previewCoverCustom
                    : { backgroundColor: selectedCoverInfo.accent },
                ]}
              >
                {selectedCoverInfo.imageUri ? (
                  <Image source={{ uri: selectedCoverInfo.imageUri }} style={styles.previewCoverImage} resizeMode="cover" />
                ) : selectedCover === 'custom' && customCoverImage ? (
                  <Image source={{ uri: customCoverImage.uri }} style={styles.previewCoverImage} resizeMode="cover" />
                ) : null}
                {/* {!(selectedCover === 'custom' && customCoverImage) && (
                  <View style={[styles.previewCoverOverlay, { flex: 1, justifyContent: 'space-between' }]}>
                    <Text style={styles.previewCoverSmall}>
                      {t('ebookPublisher.previewTag')}
                    </Text>

                    <Text style={styles.previewCoverTitle} numberOfLines={3}>
                      {title || 'Untitled Book'}
                    </Text>

                    <Text style={styles.previewCoverFooter}>
                      {allowDownload ? 'DOWNLOAD ON' : 'DOWNLOAD OFF'}
                    </Text>
                  </View>
                )} */}
              </View>
              <View style={styles.previewMeta}>
                <Text style={[styles.previewTitle, textStyle]} numberOfLines={2}>{title}</Text>
                <Text style={styles.previewDescription}>{description}</Text>
                <View style={styles.previewStats}>
                  <View style={styles.previewStat}>
                    <Ionicons name="layers-outline" size={16} color={text} />
                    <Text style={styles.previewStatText}>
                      {chapterCount} chapters
                    </Text>
                  </View>
                  <View style={styles.previewStat}>
                    <Ionicons name="document-text-outline" size={16} color={text} />
                    <Text style={styles.previewStatText}>
                      {selectedPdf ? selectedPdf.name : t('ebookPublisher.noPdf')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.settingsCard, { borderColor: `${text}33` }]}>
              <View style={styles.settingsRow}>
                <Text style={styles.settingLabel}>Allow download</Text>
                <Switch
                  value={allowDownload}
                  onValueChange={setAllowDownload}
                  trackColor={{ false: switchTrackOff, true: text }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Price Card */}
              {fromRootNavigator && (
                <View style={[styles.priceCard, { borderColor: `${text}22` }]}>
                  <Text style={[styles.priceLabel, { color: text }]}>Price per Book</Text>
                  <View style={styles.priceInputRow}>
                    <View style={[styles.priceDollar, { borderColor: `${text}22` }]}>
                      <Text style={[styles.priceDollarText, { color: text }]}>$</Text>
                    </View>
                    <TextInput
                      value={String(amount)}
                      onChangeText={val => setAmount(val.replace(/[^0-9.]/g, ''))}
                      style={[styles.priceInput, { color: text }]}
                      placeholder="0.00"
                      placeholderTextColor={`${text}66`}
                      keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
                    />
                  </View>
                  <Text style={styles.priceHint}>Suggested price range: $2.99 - $49.99</Text>
                </View>
              )}

              {/* Promo toggle + input */}
              <View style={styles.promoRow}>
                <View style={styles.promoLeft}>
                  <Text style={[styles.settingTitle]}>Add Promo Code (Optional)</Text>
                  <Text style={[styles.settingSubtitle]}>Create a discount code to promote your e-book</Text>
                </View>
                <View style={styles.promoRight}>
                  <Switch
                    value={promoEnabled}
                    onValueChange={setPromoEnabled}
                    trackColor={{ false: switchTrackOff, true: text }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              {promoEnabled && (
                <View style={[styles.promoInputWrap, { borderColor: `${text}22` }]}>
                  <TextInput
                    value={promoCode}
                    onChangeText={setPromoCode}
                    style={[styles.inputText, styles.promoInput, { color: text }]}
                    placeholder="Enter promo code"
                    placeholderTextColor={`${text}66`}
                    autoCapitalize="characters"
                  />
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: accent, opacity: isSubmitting ? 0.75 : 1 }]}
              onPress={handlePublish}
              disabled={isSubmitting}
            >
              <Text style={styles.primaryButtonText}>
                {isPublished ? t('ebookPublisher.published') : t('ebookPublisher.publishButton')}
              </Text>
            </TouchableOpacity>
          </View>
            )}

            <View style={styles.footerActions}>
              {stepOneTab === 'upload' && step > 1 && (
                <TouchableOpacity style={[styles.footerButton, { borderColor: text }]} onPress={() => setStep(step - 1)}>
                  <Text style={[styles.footerButtonText, { color: text }]}>{tf('ebookPublisher.back', 'Back')}</Text>
                </TouchableOpacity>
              )}
              {stepOneTab === 'upload' && step < 3 && (
                <TouchableOpacity
                  style={[styles.footerButton, styles.footerButtonPrimary, { backgroundColor: accent }]}
                  onPress={() => setStep(prev => (prev === 1 && !selectedPdf ? prev : Math.min(3, prev + 1)))}
                >
                  <Text style={styles.footerButtonPrimaryText}>
                    {step === 1 ? tf('ebookPublisher.continue', 'Continue') : tf('ebookPublisher.reviewButton', 'Review')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </KeyboardAwareScrollView>
    </View>
  );
};

const makeStyles = ({
  isDarkMode,
  card,
  border,
  mutedText,
  text,
  icon,
  accent,
  onAccent,
  surface,
  surfaceAlt,
  infoSurface,
  foreground,
  foregroundSoft,
  placeholder,
  errorSurface,
  errorRed,
  successSurface,
  successGreen,
}) => StyleSheet.create({
  screen: { flex: 1, marginBottom: '5%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 18 : 18,
    paddingBottom: 16,
    borderRadius: 24,
    // borderBottomLeftRadius: 24,
    // borderBottomRightRadius: 24,
    marginBottom: 16,
    marginHorizontal: 12,
    marginTop: '10%'

  },
  headerIconButton: { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 13, color: mutedText, marginTop: 4, textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  topToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: border,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
  },
  topToggleButton: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: card,
  },
  topToggleText: { fontWeight: '700', color: foregroundSoft },
  topToggleTextActive: { color: onAccent },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: border,
    marginBottom: 16,
  },
  progressFill: { height: '100%', borderRadius: 999 },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  stepItem: { alignItems: 'center', flex: 1 },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: card,
  },
  stepNumber: { fontSize: 14, fontWeight: '700', color: mutedText },
  stepLabel: { fontSize: 11, marginTop: 6, color: mutedText, textAlign: 'center' },
  card: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  libraryTitle: { fontSize: 18, fontWeight: '800', marginBottom: 2, color: foreground },
  sectionText: { fontSize: 13, color: mutedText, marginBottom: 14, lineHeight: 19 },
  helperText: { fontSize: 12, color: mutedText, marginBottom: 8, fontWeight: '600' },
  uploadArea: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 24,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface,
  },
  uploadPrimary: { marginTop: 12, fontSize: 16, fontWeight: '700', color: foregroundSoft },
  uploadSecondary: { marginTop: 8, fontSize: 13, color: mutedText },
  uploadButton: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: 140,
    alignItems: 'center',
  },
  uploadButtonText: { color: onAccent, fontWeight: '700' },
  limitText: { marginTop: 14, fontSize: 12, color: mutedText },
  libraryPanel: { gap: 12 },
  libraryStateText: { fontSize: 14, color: mutedText, fontWeight: '600', paddingVertical: 8 },
  searchBar: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: card,
  },
  searchInput: { flex: 1, color: foreground, fontSize: 13, paddingVertical: 0, paddingHorizontal: 0 },
  filterRow: { gap: 10, paddingVertical: 2 },
  filterPill: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: { fontSize: 12, fontWeight: '600', color: mutedText },
  libraryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: card,
  },
  libraryCover: {
    width: 52,
    height: 68,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  libraryCoverImage: {
    width: '100%',
    height: '100%',
  },
  libraryCoverText: { color: '#fff', fontWeight: '900', fontSize: 12, textAlign: 'center' },
  libraryMeta: { flex: 1 },
  libraryItemTitle: { fontSize: 14, fontWeight: '800', color: foreground },
  libraryItemSubtitle: { marginTop: 2, fontSize: 12, color: mutedText },
  libraryCategory: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  progressLine: {
    height: 4,
    borderRadius: 999,
    backgroundColor: border,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressLineFill: { height: '100%', borderRadius: 999 },
  progressLabel: { marginTop: 4, fontSize: 11, color: mutedText, fontWeight: '600' },
  libraryActions: { alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', paddingVertical: 4 },
  fileRow: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: errorSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileBadgeText: { color: errorRed, fontWeight: '800', fontSize: 12 },
  fileMeta: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '700' },
  fileSize: { fontSize: 12, color: mutedText, marginTop: 2 },
  infoBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: infoSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: { flex: 1, fontSize: 12, color: foregroundSoft, lineHeight: 18 },
  fieldLabel: { marginTop: 16, marginBottom: 10, fontSize: 15, fontWeight: '700', color: foregroundSoft },
  coverRow: { gap: 12, paddingRight: 8 },
  coverCard: {
    width: 156,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: border,
    backgroundColor: card,
  },
  coverPreview: { height: 108, borderRadius: 16, marginBottom: 12 },
  customCoverImage: { width: '100%', height: '100%', borderRadius: 16 },
  coverTitle: { fontWeight: '800', color: foreground },
  coverSubtitle: { fontSize: 12, color: mutedText, marginTop: 4, lineHeight: 16 },
  coverSelected: { marginTop: 8, fontSize: 12, fontWeight: '700' },
  uploadCoverCard: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  inputLike: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: surfaceAlt,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputField: { paddingVertical: 0, color: foreground },
  textAreaLike: {
    minHeight: 92,
    borderRadius: 16,
    backgroundColor: surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  textAreaField: { minHeight: 64, color: foreground },
  inputText: { fontSize: 14, color: foreground, lineHeight: 20 },
  chapterList: {
    marginTop: 6,
    gap: 10,
  },
  chapterRow: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: border,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: card,
  },
  chapterText: { flex: 1, fontSize: 13, color: foregroundSoft, fontWeight: '600' },
  chapterAction: { paddingHorizontal: 6, paddingVertical: 8 },
  chapterEditor: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: border,
    padding: 12,
    backgroundColor: surfaceAlt,
  },
  chapterInput: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 12,
    color: foreground,
    backgroundColor: card,
  },
  addChapterButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: card,
  },
  addChapterButtonText: { fontWeight: '800' },
  previewCard: {
    flexDirection: 'row',
    borderRadius: 24,
    borderWidth: 1.2,
    overflow: 'hidden',
    marginTop: 8,
    backgroundColor: card,
  },
  previewCover: {
    width: 120,
    paddingHorizontal: 8,
    justifyContent: 'space-between',
  },
  previewCoverImage: {
    ...StyleSheet.absoluteFillObject,
    width: '120%',
    height: '115%',
  },
  previewCoverSmall: { color: '#fff', fontSize: 11, fontWeight: '700', opacity: 0.9 },
  previewCoverTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 18, flex: 1 },
  previewCoverFooter: { color: '#fff', fontSize: 11, fontWeight: '700' },
  previewMeta: { flex: 1, padding: 14 },
  previewTitle: { fontSize: 18, fontWeight: '900' },
  previewAuthor: { fontSize: 13, color: mutedText, marginTop: 4 },
  previewDescription: { fontSize: 13, color: foregroundSoft, marginTop: 10, lineHeight: 19 },
  previewStats: { marginTop: 14, gap: 10 },
  previewStat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewStatText: { fontSize: 12, color: foregroundSoft, flex: 1 },
  priceCard: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: card,
  },
  priceLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  priceInputRow: { flexDirection: 'row', alignItems: 'center' },
  priceDollar: { width: 44, height: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: card },
  priceDollarText: { fontSize: 18, fontWeight: '800' },
  priceInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  priceHint: { fontSize: 12, color: mutedText, marginTop: 8 },
  promoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  promoLeft: { flex: 1, paddingRight: 8 },
  promoRight: { width: 64, alignItems: 'flex-end' },
  promoInputWrap: { marginTop: 12, borderWidth: 1, borderRadius: 10, backgroundColor: card, paddingHorizontal: 12 },
  promoInput: { minHeight: 44, paddingVertical: 10 },
  settingsCard: { marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: surface },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  settingLabel: { fontSize: 13, color: mutedText },
  settingValue: { fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  primaryButton: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: onAccent, fontWeight: '900', fontSize: 16 },
  footerActions: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  footerButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: card,
  },
  footerButtonPrimary: { borderWidth: 0 },
  footerButtonText: { fontWeight: '800' },
  footerButtonPrimaryText: { color: onAccent, fontWeight: '900' },
  bottomSpacer: { height: 24 },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: foreground,
  },

  settingSubtitle: {
    fontSize: 12,
    color: mutedText,
    marginTop: 4,
    maxWidth: '85%',
  },
  rootHeader: {
    marginHorizontal: 12,
    borderRadius: 28,
    paddingHorizontal: 12,
    marginBottom: 16,
    marginTop: '10%'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rootContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  rootStepper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  rootStepItem: {
    flex: 1,
    alignItems: 'center',
  },
  rootStepTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginLeft: '50%'
  },
  rootStepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: card,
  },
  rootStepCircleText: {
    fontSize: 12,
    fontWeight: '800',
    color: mutedText,
  },
  rootStepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
    borderRadius: 999,
    opacity: 0.35,
  },
  rootStepLabel: {
    fontSize: 12,
    color: mutedText,
    fontWeight: '700',
    marginLeft: -10
  },
  rootPricingWrap: {
    gap: 14,
  },
  rootSectionTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: foreground,
    marginTop: 6,
  },
  rootSectionSubtitle: {
    fontSize: 14,
    color: mutedText,
    marginBottom: 4,
  },
  rootCard: {
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  rootCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  rootCardBody: {
    fontSize: 13,
    color: mutedText,
    marginBottom: 14,
    lineHeight: 18,
  },
  rootPriceField: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    backgroundColor: card,
    paddingHorizontal: 12,
  },
  rootCurrency: {
    fontSize: 18,
    fontWeight: '800',
    color: accent,
    marginRight: 10,
  },
  rootPriceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    paddingVertical: 0,
  },
  rootHint: {
    marginTop: 10,
    fontSize: 12,
    color: mutedText,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  earningsLabel: {
    fontSize: 13,
    color: foregroundSoft,
    fontWeight: '600',
  },
  earningsValue: {
    fontSize: 13,
    color: foreground,
    fontWeight: '800',
  },
  earningsDivider: {
    height: 1,
    backgroundColor: border,
    marginVertical: 8,
  },
  earningsTotalLabel: {
    color: accent,
    fontWeight: '800',
  },
  earningsTotalValue: {
    color: successGreen,
    fontSize: 16,
  },
  rootPromoTitle: {
    fontSize: 15,
  },
  rootPromoSubtitle: {
    fontSize: 12,
    color: mutedText,
    marginTop: 4,
    maxWidth: '90%',
  },
  rootPrimaryButton: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  rootPrimaryButtonText: {
    color: onAccent,
    fontWeight: '900',
    fontSize: 16,
  },
  rootSuccessCard: {
    borderRadius: 22,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 520,
  },
  successConfetti: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    bottom: 18,
  },
  confettiDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confettiDotA: { top: 20, left: 38, backgroundColor: '#34C759', transform: [{ rotate: '18deg' }] },
  confettiDotB: { top: 48, right: 38, backgroundColor: '#F5C542', transform: [{ rotate: '18deg' }] },
  confettiDotC: { top: 94, left: 18, backgroundColor: '#8ED1FC', transform: [{ rotate: '18deg' }] },
  confettiDotD: { top: 110, right: 18, backgroundColor: '#C7B9E8', transform: [{ rotate: '18deg' }] },
  successBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: successGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    marginBottom: 18,
    backgroundColor: card,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: foreground,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: mutedText,
    textAlign: 'center',
    marginBottom: 18,
  },
  successBookCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: border,
    borderRadius: 18,
    padding: 12,
    backgroundColor: card,
  },
  successBookCover: {
    width: 72,
    height: 96,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: accent,
  },
  successBookCoverImage: {
    width: '100%',
    height: '100%',
  },
  successBookCoverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  successBookCoverFallbackText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 11,
    textAlign: 'center',
  },
  successBookMeta: {
    flex: 1,
  },
  successBookTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: foreground,
  },
  successBookPrice: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '900',
    color: foreground,
  },
  publishedPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: successSurface,
  },
  publishedPillText: {
    color: successGreen,
    fontWeight: '800',
    fontSize: 12,
  },
  goClosetButton: {
    marginTop: 18,
    minHeight: 52,
    paddingHorizontal: 22,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  goClosetButtonText: {
    color: onAccent,
    fontSize: 15,
    fontWeight: '900',
  },
});

export default EbookPublisher;
