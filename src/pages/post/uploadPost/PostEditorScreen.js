import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomButton from '../../../components/customButton/customButton';
import { useToast } from 'react-native-toast-notifications';
import { createPost } from '../../../services/post';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';

const { width: screenWidth } = Dimensions.get('window');

const PostEditorScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { images = [], currentFilter = 'none', metadata = {}, imageEdits, postType } = route.params || {};
  const [caption, setCaption] = useState('');
  const [link, setLink] = useState('');
  const toast = useToast();
  console.log('PostEditor received data:', { images, currentFilter, metadata, imageEdits, postType });

  const handlePost = async () => {
    if (postType == 'crowdfunding') {

      if (link && !isValidLink(link)) {
        showToastMessage(toast, 'danger', 'Please enter a valid link starting with http:// or https://');
        return;
      }

      navigation.navigate('CreateMission', {
        images,
        caption,
        link
      });
    }
    else {
      dispatch(showLoader());
      const payload = {
        // text: caption.trim(),
        caption: caption.trim(),
        // hashtag: [],        
        // location: '',      
        // music: '',          
        // taggedPeople: [],  
        media: images.map(img => ({
          uri: img.processedUri || img.uri,
          type: img.type,
          name: (img.processedUri || img.uri).split('/').pop()
        })),
        type: 'normal',
      };

      try {
        const response = await createPost(payload)
        console.log('rrrrrrrrrrrrrrrrrrrrrrrr', response);

        if (response.statusCode == 200) {
          showToastMessage(toast, 'success', 'Post created successfully');
          navigation.navigate('HomeMain');
        }
        else {
          showToastMessage(toast, 'danger', 'Please try again');
        }
      } catch (err) {
        console.error('Post creation error:', err);
        showToastMessage(toast, 'success', err.response.message);
      } finally {
        dispatch(hideLoader());
      }
    }
  };

  const isValidLink = (text) => {
    const urlPattern = /^(https?:\/\/)?([\w.-]+)\.([a-z]{2,})([\/\w .-]*)*\/?$/i;
    return urlPattern.test(text);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>New Post</Text>
        <Text></Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Images Card with horizontal scroll */}
        {images.length > 0 && (
          <View style={styles.imagesCard}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imagesContainer}
            >
              {images.map((img, idx) => (
                <View key={idx} style={styles.imageThumbWrapper}>
                  <Image
                    source={{ uri: img.processedUri || img.uri }}
                    style={styles.imageThumb}
                    resizeMode="cover"
                  />
                  {img.appliedFilter && img.appliedFilter !== 'none' && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{img.filterName}</Text>
                    </View>
                  )}
                  {/* {(img.textOverlays?.length > 0 ||
                    img.overlayImages?.length > 0 ||
                    img.hasDrawing) && (
                      <View style={styles.overlayIndicators}>
                        {img.textOverlays?.length > 0 && (
                          <View style={styles.indicator}>
                            <Text style={styles.indicatorText}>T</Text>
                          </View>
                        )}
                        {img.overlayImages?.length > 0 && (
                          <View style={styles.indicator}>
                            <Text style={styles.indicatorText}>I</Text>
                          </View>
                        )}
                        {img.hasDrawing && (
                          <View style={styles.indicator}>
                            <Text style={styles.indicatorText}>D</Text>
                          </View>
                        )}
                      </View>
                    )} */}
                </View>
              ))}

            </ScrollView>
          </View>
        )}

        {/* Caption Input */}
        <View style={styles.captionSection}>
          <Text style={styles.captionLabel}>Write a caption (optional)</Text>
          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption (optional)"
            value={caption}
            onChangeText={setCaption}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Link Input */}
        {
          postType == 'crowdfunding' && (
            <View style={[styles.captionSection, { marginTop: -5 }]}>
              <Text style={styles.captionLabel}>Add a link (optional)</Text>
              <TextInput
                style={styles.linkInput}
                placeholder="https://example.com"
                value={link}
                onChangeText={setLink}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}
      </ScrollView>

      <CustomButton
        title="Continue"
        onPress={handlePost}
        style={[styles.socialBtn, styles.instagramBtn]}
        textStyle={styles.socialBtnText}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f2fd' },
  header: {
    height: 56,
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
  content: { flex: 1, backgroundColor: '#f8f2fd' },
  imagesCard: {
    margin: 16,
    backgroundColor: '#f8f2fd',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  imagesContainer: {
    paddingVertical: 12,
    paddingHorizontal: 8
  },
  imageThumbWrapper: {
    marginRight: 12,
    position: 'relative'
  },
  imageThumb: {
    width: screenWidth * 0.3,
    height: screenWidth * 0.3,
    borderRadius: 8
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
    backgroundColor: '#5a2d82',
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
  captionInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    fontSize: 16,
    backgroundColor: '#f8f2fd',
    color: '#000'
  },
  linkInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f8f2fd',
    color: '#000'
  },
  instagramBtn: {
    backgroundColor: '#5a2d82',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#5a2d82',
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