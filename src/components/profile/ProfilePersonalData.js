import { Image, StyleSheet, Text, TouchableOpacity, View, Alert, Platform, PermissionsAndroid } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import ProfileModal from '../modals/ProfileModal';
import UsernameModal from '../modals/UsernameModal';
import TradeModal from '../modals/TradeModal';
import { showLoader, hideLoader } from '../../redux/actions/LoaderAction';
import { useDispatch } from 'react-redux';
import { EditProfile, getProfile } from '../../services/createProfile';
import { PostStory } from '../../services/stories'; // Import PostStory API
import { WhiteDragonfly, Thread, BlueDragonfly, SoftGrayDragonfly, LilacDragonfly, GoldDragonfly, GoldLavenderDragonfly } from '../../assets/icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setProfileImg } from '../../redux/actions/ProfileImgAction';
import { showToastMessage } from '../displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import StoryComposer from '../home/story.js/StoryComposer';
import { getUserCredentials } from '../../services/post';

export function getDragonflyIcon(followers, isBusiness = false) {
  if (isBusiness) return GoldLavenderDragonfly;

  if (followers <= 50) return WhiteDragonfly;
  if (followers <= 10000) return SoftGrayDragonfly;
  if (followers <= 500000) return LilacDragonfly;
  if (followers <= 1000000) return GoldDragonfly;
  if (followers >= 10000000) return GoldLavenderDragonfly;

  return WhiteDragonfly;
}

const ProfilePersonData = ({
  displayName,
  username,
  profilepic,
  bio,
  dashboard,
  fromUsersProfile = false,
  isFollowing = null,
  onToggleFollow,
  followBusy = false,
  targetUserId,
  purchaseSheetRef,
  onStoryUploaded, // Callback to refresh stories after upload
  userData,
  executeFollowAction
}) => {

  useEffect(() => {
    console.log(
      { userData },
      'ProfilePersonData props'
    );
  }, [displayName, username, profilepic, bio, dashboard, fromUsersProfile, isFollowing, followBusy, targetUserId]);

  const navigation = useNavigation();
  const [profileImage, setProfileImage] = useState(null);

  useEffect(() => {
    setProfileImage(profilepic || null);
    fetchAllData();
  }, [profilepic]);

  const PLACEHOLDER_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
  const avatarUri = typeof profileImage === 'string' && profileImage.length ? profileImage : PLACEHOLDER_AVATAR;

  const [modalVisible, setModalVisible] = useState(false);
  const [usernameModalVisible, setUsernameModalVisible] = useState(false);
  const [tradeModalVisible, setTradeModalVisible] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const [composerList, setComposerList] = useState([]);
  const [data, setData] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isBusinessProfile, setIsBusinessProfile] = useState(false);
  const [userProfile, setUserProfile] = useState('');
  // console.log('item----------------followers------------', item);
  const isCompanyProfile = userProfile === 'company';
  const dispatch = useDispatch();
  const toast = useToast();

  const Userdata = {
    Displayname: displayName || 'No Name',
    Username: username || 'Unknown User',
    profilePic: profileImage,
    Bio: bio,
    totalPost: dashboard?.totalPosts ?? 'NA',
    Followers: dashboard?.totalFollowers ?? 'NA',
    Followings: dashboard?.totalFollowing ?? 'NA',
    userId: userId,
  };

  const fetchAllData = async () => {
    try {
      dispatch(showLoader());

      // Run both API calls in parallel
      const [profileResponse] = await Promise.all([
        getUserCredentials(userData.id)
      ]);

      // Handle profile response
      if (profileResponse?.statusCode === 200) {
        let userDataToSet;
        if (profileResponse.data && profileResponse.data.user) {
          userDataToSet = profileResponse.data.user;
        } else if (profileResponse.data) {
          userDataToSet = profileResponse.data;
        } else {
          userDataToSet = profileResponse;
        }
        setUserProfile(userDataToSet.profile || '');
        // console.log('User profile:', userDataToSet.profile);
      } else {
        showToastMessage(toast, 'danger', profileResponse.data.message);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      dispatch(hideLoader());
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'This app needs access to your camera to take photos.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const handleProfileImagePress = () => {
    Alert.alert(
      'Upload Image',
      'What would you like to upload?',
      [
        {
          text: 'Story',
          onPress: () => handleStoryUpload(),
        },
        {
          text: 'Profile Image',
          onPress: () => showImageSourceOptions(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleStoryUpload = () => {
    Alert.alert(
      'Add Story',
      'Choose how to add your story',
      [
        { text: 'Camera', onPress: () => openStoryCamera() },
        { text: 'Gallery', onPress: () => openStoryGallery() },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const openStoryCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Denied',
        'Camera permission is required to take photos.',
      );
      return;
    }
    const options = {
      mediaType: 'mixed',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      includeExtra: true,
      presentationStyle: 'fullScreen',
    };
    launchCamera(options, response => {
      if (response?.didCancel) return;
      if (response?.errorCode) {
        Alert.alert(
          'Camera error',
          response.errorMessage || response.errorCode,
        );
        return;
      }
      handleStoryMediaSelected(response);
    });
  };

  const openStoryGallery = () => {
    const options = {
      mediaType: 'mixed',
      selectionLimit: 10,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
    };
    launchImageLibrary(options, response => {
      if (response?.didCancel || response?.errorCode) return;
      const assets = response?.assets || [];
      if (!assets.length) return;

      const list = assets.map(a => ({
        uri: a.uri,
        type: a.type?.startsWith('video') ? 'video' : 'image',
        duration: a.duration ? a.duration * 1000 : undefined,
      }));
      setComposerList(list);
      setComposerVisible(true);
      handleStoryMediaSelected(response);
    });
  };

  const handleStoryMediaSelected = response => {
    const asset = response?.assets?.[0];
    if (!asset || !asset.uri) {
      Alert.alert('Oops', 'Could not read the selected media.');
      return;
    }
    const type = asset.type?.startsWith('video') ? 'video' : 'image';
    const duration =
      type === 'video'
        ? asset.duration
          ? asset.duration * 1000
          : 15000
        : 5000;

    // If single item, set it directly
    if (response?.assets?.length === 1) {
      setComposerList([{ type, uri: asset.uri, duration }]);
    }
    setComposerVisible(true);
  };

  const handleComposerDone = async (processedArray) => {
    try {
      setComposerVisible(false);

      // Prepare FormData for API call
      const formData = new FormData();

      // Add caption (optional)
      formData.append('caption', '');

      // Add media files
      processedArray.forEach((item, index) => {
        const fileUri = item.processedUri || item.original.uri;
        const fileName = `story_${Date.now()}_${index}.${item.isVideo ? 'mp4' : 'jpg'}`;
        const fileType = item.isVideo ? 'video/mp4' : 'image/jpeg';

        formData.append('media', {
          uri: fileUri,
          type: fileType,
          name: fileName,
        });
      });

      // Call API to upload story
      const response = await PostStory(formData);

      if (response?.success) {
        showToastMessage(toast, 'success', 'Story Uploaded Successfully');

        // Call the callback to refresh stories if provided
        if (onStoryUploaded) {
          onStoryUploaded();
        }
      } else {
        showToastMessage(toast, 'danger', 'Failed to upload story please try again');
      }
    } catch (error) {
      console.error('Error uploading story:', error);
      showToastMessage(toast, 'danger', 'Something Went Wrong ! please try again');
    }
  };

  const showImageSourceOptions = () => {
    Alert.alert(
      'Select Image Source',
      'Choose where to pick your profile image from',
      [
        {
          text: 'Camera',
          onPress: () => openCamera(),
        },
        {
          text: 'Gallery',
          onPress: () => openGallery(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Denied',
        'Camera permission is required to take photos.',
      );
      return;
    }
    try {
      launchCamera(
        {
          mediaType: 'photo',
          quality: 0.8,
          cameraType: 'back',
        },
        async response => {
          await processImageResponse(response);
        }
      );
    } catch (err) {
      console.error("Camera error:", err);
      showToastMessage(toast, 'danger', 'Failed to open camera');
    }
  };

  const openGallery = () => {
    try {
      launchImageLibrary(
        {
          mediaType: 'photo',
          quality: 0.8,
          selectionLimit: 1,
        },
        async response => {
          await processImageResponse(response);
        }
      );
    } catch (err) {
      console.error("Gallery error:", err);
      showToastMessage(toast, 'danger', 'Failed to open gallery');
    }
  };

  const processImageResponse = async (response) => {
    if (response?.didCancel) return;

    if (response?.errorCode) {
      console.warn("Image Picker Error:", response.errorMessage);
      showToastMessage(toast, 'danger', 'Failed to pick image');
      return;
    }

    const asset = response?.assets?.[0];
    if (!asset?.uri) {
      console.warn("No valid image URI found");
      showToastMessage(toast, 'danger', 'No image selected');
      return;
    }

    const pickedUri = asset.uri;
    setProfileImage(pickedUri);

    // Always provide fallbacks
    const fileName = asset.fileName || `profile_${Date.now()}.jpg`;
    const mimeType = asset.type || "image/jpeg";

    // Special case: Android content:// URIs
    const imageUri = pickedUri.startsWith("content://")
      ? pickedUri
      : pickedUri;

    const formData = new FormData();
    formData.append("image", {
      uri: imageUri,
      type: mimeType,
      name: fileName,
    });

    await handleSaveProfile(formData, pickedUri);
  };

  const handleSaveProfile = async (data, img) => {
    try {
      dispatch(showLoader());
      console.log(data, 'data to be sent handleSaveProfile');

      const res = await EditProfile(data);
      console.log(res, 'edit profile response');

      if (res.statusCode === 200) {
        dispatch(setProfileImg(img));
        showToastMessage(toast, 'success', res.data.message);
      } else {
        showToastMessage(toast, 'danger', res.data.message);
      }
    } catch (err) {
      // showToastMessage(toast, 'danger', err.response?.data?.message || 'Error saving profile');
    } finally {
      dispatch(hideLoader());
    }
  };

  const UserMessageNavigation = () => {
    navigation.navigate('UserChat', {
      userId: targetUserId,
      user: ''
    });
  }

  useFocusEffect(
    useCallback(() => {
      // if (fromUsersProfile) return;
      let isActive = true;

      const fetchProfile = async () => {
        try {
          dispatch(showLoader());
          const id = await AsyncStorage.getItem('userId');
          setUserId(id);
          if (!id) return;

          const response = await getProfile(id);
          if (!isActive) return;

          if (response.statusCode === 200 && response.data) {
            console.log('response in fetchProfile useFocusEffect:', response);
            if (!fromUsersProfile) {
              setData(response.data);
              if (response.data.image) {
                setProfileImage(response.data.image);
              }
            }
            if (response?.data?.profile === 'company') {
              setIsBusinessProfile(true);
            }
          }
        } catch (err) {
          if (isActive) {
            // Handle error
          }
        } finally {
          if (isActive) {
            dispatch(hideLoader());
          }
        }
      };

      fetchProfile();

      return () => {
        isActive = false;
      };
    }, [dispatch, fromUsersProfile]),
  );

  const handleNavigate = () => {
    if (data) {
      navigation.navigate('EditProfile', { userdata: data });
    } else {
      Alert.alert('Please wait', 'Profile data is still loading');
    }
  };

  const redirect = () => {
    if (data) {
      console.log(data, 'dtaaaaa');
      navigation.navigate('ShareProfile', { userData: data });
    }
  };

  const DragonflyIcon = getDragonflyIcon(Userdata.Followers, isCompanyProfile);

  return (
    <View style={{ marginLeft: 5, marginRight: 5, marginTop: 5 }}>
      <View style={[styles.container, { backgroundColor: userData?.profile === 'company' ? '#fcfbfaff' : '#f8f2fd' }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.usernameRow}>
            <TouchableOpacity
              style={styles.usernameTouchable}
              activeOpacity={0.5}
              onPress={() => setUsernameModalVisible(true)}
            >
              {fromUsersProfile && (
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                >
                  <Ionicons
                    name="arrow-back-outline"
                    size={22}
                    color="#111100"
                    style={{ marginRight: 4 }}
                  />
                </TouchableOpacity>
              )}
              <View style={styles.userRow}>
                <Text style={[styles.headerText, { color: userData?.profile === 'company' ? '#D3B683' : '#5a2d82' }]}>{Userdata.Username}</Text>
                <DragonflyIcon width={22} height={22} style={styles.icon} />
                {!fromUsersProfile && (
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color="#111100"
                    style={{ marginLeft: 4 }}
                  />
                )}
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.iconContainer}>
            {!fromUsersProfile && (
              <TouchableOpacity style={styles.iconButton} onPress={() => { navigation.navigate('wallet') }}>
                <Ionicons name="wallet-outline" size={25} color="#111100" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                redirect();
              }}
            >
              <Ionicons name="share-outline" size={25} color="#111100" />
            </TouchableOpacity>
            {!fromUsersProfile && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setModalVisible(true)}
              >
                <FontAwesome name="plus-square-o" size={25} color="#111100" />
              </TouchableOpacity>
            )}

            {fromUsersProfile ? (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setUsernameModalVisible(true)}
              >
                <Ionicons
                  name="ellipsis-horizontal-outline"
                  size={25}
                  color="#111100"
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation.navigate('Settings')}
              >
                <Feather name="menu" size={25} color="#111100" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profile}>
          <View style={styles.profileView}>
            <View style={styles.profileWraper}>
              <TouchableOpacity
                onPress={handleProfileImagePress}
                activeOpacity={0.8}
                style={{ marginBottom: 5 }}
              >
                <Image
                  source={{ uri: avatarUri }}
                  style={[styles.image, { borderColor: isCompanyProfile ? '#D3B683' : '#5a2d82' }]}
                  resizeMode="cover"
                />
                {!fromUsersProfile && (
                  <TouchableOpacity
                    style={[styles.addbutton, { backgroundColor: isCompanyProfile ? '#D3B683' : '#5a2d82', shadowColor: isCompanyProfile ? '#D3B683' : '#5a2d82' }]}
                    onPress={handleProfileImagePress}
                  >
                    <Ionicons name="add" size={15} color="white" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              <View>
                <Text style={styles.displaynamee}>{Userdata.Displayname}</Text>
              </View>
            </View>

            <View style={styles.edit}>
              {fromUsersProfile ? (
                <>
                  <TouchableOpacity disabled={followBusy} onPress={() => purchaseSheetRef.current?.open()}>
                    {
                      !isBusinessProfile && (
                        userData?.profile !== 'company' && (
                          isFollowing && (
                            <LinearGradient
                              colors={
                                userData?.profile === 'company'
                                  ? ['#D3B683', '#e54ba0']
                                  : ['#513189bd', '#e54ba0']
                              }
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[styles.editbuttons, { shadowColor: userData?.profile === 'company' ? '#D3B683' : '#5a2d82' }]}
                            >
                              <Text style={styles.buttonText}>Buy</Text>
                            </LinearGradient>
                          )
                        )
                      )
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={
                      isBusinessProfile
                        ? undefined
                        : (userData?.profile == 'company'
                          ? executeFollowAction
                          : onToggleFollow)
                    }
                    disabled={followBusy || isFollowing === null}
                  >
                    <LinearGradient
                      colors={
                        userData?.profile === 'company'
                          ? ['#D3B683', '#e54ba0']
                          : ['#513189bd', '#e54ba0']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.editbuttons, { shadowColor: userData?.profile === 'company' ? '#D3B683' : '#5a2d82' }]}
                    >
                      <Text style={styles.buttonText}>
                        {isBusinessProfile ? 'Support' : isFollowing ? 'Vallowing' : 'Vallow'}
                        {followBusy ? '...' : ''}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => UserMessageNavigation()}
                  >
                    <LinearGradient
                      colors={
                        userData?.profile === 'company'
                          ? ['#D3B683', '#e54ba0']
                          : ['#513189bd', '#e54ba0']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.editbuttons, { shadowColor: userData?.profile === 'company' ? '#D3B683' : '#5a2d82' }]}
                    >
                      <Text style={styles.buttonText}>
                        Message
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => handleNavigate()}>
                    <LinearGradient
                      colors={
                        userData?.profile === 'company'
                          ? ['#D3B683', '#e54ba0']
                          : ['#513189bd', '#e54ba0']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.editbuttons, { shadowColor: userData?.profile === 'company' ? '#D3B683' : '#5a2d82' }]}
                    >
                      <Text style={styles.buttonText}>Edit Profile</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('Invite', {
                        referralUrl: 'https://example.com/referral?code=ABC123',
                        avatar: Userdata.profilePic,
                      })
                    }
                  >
                    <LinearGradient
                      colors={
                        userData?.profile === 'company'
                          ? ['#D3B683', '#e54ba0']
                          : ['#513189bd', '#e54ba0']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.editbuttons, { shadowColor: userData?.profile === 'company' ? '#D3B683' : '#5a2d82' }]}
                    >
                      <Ionicons
                        name="person-add-sharp"
                        size={15}
                        color="white"
                      />
                      <Text style={styles.buttonText}> Invite</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity>
                    <LinearGradient
                      colors={
                        userData?.profile === 'company'
                          ? ['#D3B683', '#e54ba0']
                          : ['#513189bd', '#e54ba0']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.editbuttons, { shadowColor: userData?.profile === 'company' ? '#D3B683' : '#5a2d82' }]}
                    >
                      <Text style={styles.buttonText}>Support</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          <View style={styles.biobox}>
            <Text style={styles.biotext}>{Userdata.Bio}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statItem}>
            <Ionicons name="add-circle-outline" size={16} color="#444" />
            <Text style={[styles.statText, { color: userData?.profile === 'company' ? '#D3B683' : '#5a2d82' }]}> Mint: {Userdata.totalPost}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statItem}
            activeOpacity={0.5}
            onPress={() => {
              if (fromUsersProfile) {
                navigation.navigate('ProfileMain', {
                  screen: 'FollowersFollowingScreen',
                  tab: 'followers',
                  params: {
                    userName: Userdata.Username,
                    userId: fromUsersProfile ? targetUserId : userId,
                  },
                });
              } else {
                navigation.navigate('FollowersFollowingScreen', {
                  tab: 'followers',
                  params: {
                    userName: Userdata.Username,
                    userId: userId,
                  },
                });
              }
            }}
          >
            <FontAwesome name="user" size={16} color="#444" />
            <Text style={[styles.statText, { color: userData?.profile === 'company' ? '#D3B683' : '#5a2d82' }]}>
              {' '}
              Vallowers: {Userdata.Followers}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statItem}
            onPress={() => {
              if (fromUsersProfile) {
                navigation.navigate('ProfileMain', {
                  screen: 'FollowersFollowingScreen',
                  tab: 'following',
                  params: {
                    userName: displayName,
                    userId: fromUsersProfile ? targetUserId : userId,
                  },
                });
              } else {
                navigation.navigate('FollowersFollowingScreen', {
                  tab: 'following',
                  params: {
                    userName: displayName,
                    userId: userId,
                  },
                });
              }
            }}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color="#444" />
            <Text style={[styles.statText, { color: userData?.profile === 'company' ? '#D3B683' : '#5a2d82' }]}>
              {' '}
              Vallowing: {Userdata.Followings}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals */}
      <ProfileModal
        modalVisible={modalVisible}
        setModalVisible={setModalVisible}
      />
      <UsernameModal
        visible={usernameModalVisible}
        onClose={() => setUsernameModalVisible(false)}
      />
      <TradeModal
        visible={tradeModalVisible}
        onClose={() => setTradeModalVisible(false)}
      />

      {/* Story Composer Modal */}
      <StoryComposer
        modalVisible={composerVisible}
        mediaList={composerList}
        onCancel={() => setComposerVisible(false)}
        onDone={handleComposerDone}
      />
    </View>
  );
};

export default ProfilePersonData;

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 16,
  },

  // --- Header ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernameTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 5,
  },
  icon: {
    marginTop: 1,
  },
  iconContainer: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 6,
    marginHorizontal: 2,
  },

  // --- Profile ---
  profile: {
    marginTop: 10,
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  profileView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  profileWraper: {
    position: 'relative',
    alignItems: 'center',
  },
  image: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  addbutton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 20,
    width: 26,
    height: 26,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  displaynamee: {
    fontSize: 18,
    color: '#1F2937',
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },

  // --- Buttons ---
  edit: {
    flexDirection: 'column',
    width: '50%',
    gap: 6,
  },
  editbuttons: {
    height: 36,
    width: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // --- Bio ---
  biobox: {
    width: '100%',
    paddingVertical: 6,
    marginTop: 6,
  },
  biotext: {
    fontStyle: 'italic',
    color: '#374151',
    fontSize: 14,
  },

  // --- Stats ---
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 14,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
});