import React, { useMemo, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { pick, types as documentTypes } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { createPost } from '../../services/post';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import RNFS from 'react-native-fs';

const MAX_PDF_SIZE_BYTES = 100 * 1024 * 1024;

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

const EbookPublisher = ({ navigation }) => {
  const { bgStyle, cardStyle, textStyle, text } = useAppTheme();
  const { t } = useLanguage();
  const dispatch = useDispatch();
  const tf = (key, fallback) => {
    const value = t(key);
    return value === key || value == null || value === '' ? fallback : value;
  };
  const [step, setStep] = useState(1);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [chapters, setChapters] = useState([]);
  const [chapterDraft, setChapterDraft] = useState('');
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [selectedCover, setSelectedCover] = useState('minimal');
  const [customCoverImage, setCustomCoverImage] = useState(null);
  const [allowDownload, setAllowDownload] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      const payload = {
        type: 'private',
        format: 'ebook',
        caption: title.trim(),
        text: buildTextArray(description),
        allowDownload,
        images: coverSource ? [coverSource] : [],
        ebookpdf: selectedPdf,
        // ✅ Must be array, NOT .join()
        tableContent: chapters.map(item => item.title), // ["Chapter1", "Chapter2"]
      };
      console.log('📚 tableContent before API call:', JSON.stringify(payload.tableContent));

      console.log('Payload:', payload);
      console.log('Cover Image:', coverSource);
      console.log('Chapters:', chapters);
      console.log('Table of Contents (titles only):', payload.tableContent);

      const response = await createPost(payload);

      console.log('API Response:', response);
      console.log('Status Code:', response?.status);
      console.log('Response Data:', response?.data);

      if (response?.status === 200) {
        console.log('✅ Ebook published successfully');
      }

      setIsPublished(true);
      navigation.goBack?.();

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

  return (
    <View style={[styles.screen, bgStyle]}>
      <View style={[styles.header, cardStyle]}>
        <TouchableOpacity onPress={() => navigation.goBack?.()} style={styles.headerIconButton}>
          <Ionicons name="close" size={24} color={text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.title, textStyle]}>{t('ebookPublisher.title')}</Text>
          <Text style={styles.subtitle}>{t('ebookPublisher.subtitle')}</Text>
        </View>
        <View style={styles.headerIconButton} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={24}
        extraHeight={Platform.OS === 'ios' ? 40 : 80}
      >
        <View style={[styles.progressTrack, cardStyle]}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: text }]} />
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
                    { borderColor: text },
                    active && { backgroundColor: text },
                    done && { backgroundColor: text },
                  ]}
                >
                  <Text style={[styles.stepNumber, (active || done) && styles.stepNumberActive]}>
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

            <TouchableOpacity style={[styles.uploadArea, { borderColor: text }]} onPress={handlePickPdf}>
              <Ionicons name="cloud-upload-outline" size={44} color={text} />
              <Text style={styles.uploadPrimary}>{t('ebookPublisher.dragDrop')}</Text>
              <Text style={styles.uploadSecondary}>{t('ebookPublisher.or')}</Text>
              <View style={[styles.uploadButton, { backgroundColor: text }]}>
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
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <Text style={styles.helperText}>Description</Text>
            <View style={styles.textAreaLike}>
              <TextInput
                value={description}
                onChangeText={setDescription}
                style={[styles.inputText, styles.textAreaField]}
                placeholder="Add each description line on a new row"
                placeholderTextColor="#9CA3AF"
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
                    <Ionicons name="reorder-three-outline" size={22} color="#9CA3AF" />
                    <Text style={styles.chapterText}>{index + 1}. {chapter.title}</Text>
                    <TouchableOpacity onPress={() => handleEditChapter(chapter)} style={styles.chapterAction}>
                      <Ionicons name="pencil-outline" size={18} color="#6B7280" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteChapter(chapter.id)} style={styles.chapterAction}>
                      <Ionicons name="trash-outline" size={18} color="#6B7280" />
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
                  placeholderTextColor="#9CA3AF"
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

            <View style={styles.settingsCard}>
              <View style={styles.settingsRow}>
                <Text style={styles.settingLabel}>Allow download</Text>
                <Switch
                  value={allowDownload}
                  onValueChange={setAllowDownload}
                  trackColor={{ false: '#D1D5DB', true: text }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: text, opacity: isSubmitting ? 0.75 : 1 }]}
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
          {step > 1 && (
            <TouchableOpacity style={[styles.footerButton, { borderColor: text }]} onPress={() => setStep(step - 1)}>
              <Text style={[styles.footerButtonText, { color: text }]}>{tf('ebookPublisher.back', 'Back')}</Text>
            </TouchableOpacity>
          )}
          {step < 3 && (
            <TouchableOpacity
              style={[styles.footerButton, styles.footerButtonPrimary, { backgroundColor: text }]}
              onPress={() => setStep(prev => (prev === 1 && !selectedPdf ? prev : Math.min(3, prev + 1)))}
            >
              <Text style={styles.footerButtonPrimaryText}>
                {step === 1 ? tf('ebookPublisher.continue', 'Continue') : tf('ebookPublisher.reviewButton', 'Review')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </KeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
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
    backgroundColor: '#fff',
  },
  stepNumber: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  stepNumberActive: { color: '#fff' },
  stepLabel: { fontSize: 11, marginTop: 6, color: '#6B7280', textAlign: 'center' },
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
  sectionText: { fontSize: 13, color: '#6B7280', marginBottom: 14, lineHeight: 19 },
  helperText: { fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: '600' },
  uploadArea: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 24,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  uploadPrimary: { marginTop: 12, fontSize: 16, fontWeight: '700', color: '#374151' },
  uploadSecondary: { marginTop: 8, fontSize: 13, color: '#6B7280' },
  uploadButton: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: 140,
    alignItems: 'center',
  },
  uploadButtonText: { color: '#fff', fontWeight: '700' },
  limitText: { marginTop: 14, fontSize: 12, color: '#6B7280' },
  fileRow: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileBadgeText: { color: '#DC2626', fontWeight: '800', fontSize: 12 },
  fileMeta: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '700' },
  fileSize: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  infoBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: { flex: 1, fontSize: 12, color: '#4B5563', lineHeight: 18 },
  fieldLabel: { marginTop: 16, marginBottom: 10, fontSize: 15, fontWeight: '700', color: '#374151' },
  coverRow: { gap: 12, paddingRight: 8 },
  coverCard: {
    width: 156,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  coverPreview: { height: 108, borderRadius: 16, marginBottom: 12 },
  customCoverImage: { width: '100%', height: '100%', borderRadius: 16 },
  coverTitle: { fontWeight: '800', color: '#111827' },
  coverSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4, lineHeight: 16 },
  coverSelected: { marginTop: 8, fontSize: 12, fontWeight: '700' },
  uploadCoverCard: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  inputLike: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputField: { paddingVertical: 0, color: '#111827' },
  textAreaLike: {
    minHeight: 92,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  textAreaField: { minHeight: 64, color: '#111827' },
  inputText: { fontSize: 14, color: '#111827', lineHeight: 20 },
  chapterList: {
    marginTop: 6,
    gap: 10,
  },
  chapterRow: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  chapterText: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '600' },
  chapterAction: { paddingHorizontal: 6, paddingVertical: 8 },
  chapterEditor: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    backgroundColor: '#FBFBFD',
  },
  chapterInput: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    color: '#111827',
    backgroundColor: '#fff',
  },
  addChapterButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  addChapterButtonText: { fontWeight: '800' },
  previewCard: {
    flexDirection: 'row',
    borderRadius: 24,
    borderWidth: 1.2,
    overflow: 'hidden',
    marginTop: 8,
    backgroundColor: '#fff',
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
  previewAuthor: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  previewDescription: { fontSize: 13, color: '#374151', marginTop: 10, lineHeight: 19 },
  previewStats: { marginTop: 14, gap: 10 },
  previewStat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewStatText: { fontSize: 12, color: '#4B5563', flex: 1 },
  settingsCard: { marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: '#F8FAFC' },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  settingLabel: { fontSize: 13, color: '#6B7280' },
  settingValue: { fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  primaryButton: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  footerActions: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  footerButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  footerButtonPrimary: { borderWidth: 0 },
  footerButtonText: { fontWeight: '800' },
  footerButtonPrimaryText: { color: '#fff', fontWeight: '900' },
  bottomSpacer: { height: 24 },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },

  settingSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    maxWidth: '85%',
  },
});

export default EbookPublisher;
