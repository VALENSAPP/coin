import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getPostById } from '../../../services/post';
import { hydratePostForEditor, buildEditorImagesFromHydrated } from '../../../utils/hydratePostForEditor';
import { useAppTheme } from '../../../theme/useApptheme';

export default function EditPostScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { bgStyle } = useAppTheme();
  const post = useMemo(() => route?.params?.post || {}, [route?.params?.post]);
  const onSave = route?.params?.onSave;
  const [launchError, setLaunchError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const launchEditor = async () => {
      if (!post?.id) {
        setLaunchError(true);
        navigation.goBack();
        return;
      }

      let postData = post;
      try {
        const response = await getPostById(String(post.id));
        const fetched =
          response?.data?.data ||
          response?.data?.post ||
          (response?.statusCode === 200 ? response?.data : null) ||
          response?.data ||
          null;
        if (fetched && typeof fetched === 'object' && !Array.isArray(fetched)) {
          postData = { ...post, ...fetched };
        }
      } catch {
        // Continue with the post payload we already have.
      }

      if (cancelled) return;

      const hydrated = hydratePostForEditor(postData);
      if (!hydrated.selectedMedia?.length) {
        setLaunchError(true);
        navigation.goBack();
        return;
      }

      navigation.replace('PostEditor', {
        images: buildEditorImagesFromHydrated(hydrated),
        imageEdits: hydrated.initialImageEdits,
        postType: hydrated.postType,
        fromIcon: hydrated.fromIcon,
        visibleTo: hydrated.visibleTo,
        isEditingPost: true,
        editSkipMediaEditor: true,
        editPostId: hydrated.editPostId,
        initialCaption: hydrated.caption,
        initialLocation: hydrated.location,
        initialHashtags: hydrated.hashtags,
        isTrustPost: hydrated.isTrustPost,
        taggedPeople: hydrated.taggedPeople,
        taggedPeopleIds: hydrated.taggedPeopleIds,
        taggedPeopleMeta: hydrated.taggedPeopleMeta,
        initialPostMeta:
          hydrated.originalPost?.postMeta || hydrated.originalPost?.post_meta || null,
        onSave,
      });
    };

    launchEditor();

    return () => {
      cancelled = true;
    };
  }, [navigation, onSave, post]);

  if (launchError) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, bgStyle]} edges={['top', 'left', 'right']}>
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
