import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';

import ProfilePersonData from '../../components/profile/ProfilePersonalData';
import HighlightStories from '../../components/profile/HighLightStories';
import ProfileTabs from '../../components/profile/ProfileTabNavigation';
import { showToastMessage } from '../../components/displaytoastmessage';
import { getPostByUser, getUserCredentials, getUserDashboard } from '../../services/post';
import { showLoader, hideLoader } from '../../redux/actions/LoaderAction';

const ProfileScreen = () => {
  const [posts, setPosts] = useState([]);
  const [userId, setUserId] = useState();
  const [userDashboard, setUserDashboard] = useState();
  const [userData, setUserData] = useState();
  const [refreshing, setRefreshing] = useState(false);

  const toast = useToast();
  const dispatch = useDispatch();

  // Single function to fetch posts, profile info, and dashboard in parallel
  const fetchAllData = useCallback(async () => {
    const id = await AsyncStorage.getItem('userId');
    if (!id) {
      showToastMessage(toast, 'danger', 'No userId in storage');
      return;
    }
    setUserId(id);
    // console.log(id, 'this is userid from async storage in profile');
    

    dispatch(showLoader());
    try {
      const [postsRes, userRes, dashRes] = await Promise.all([
        getPostByUser(id),
        getUserCredentials(id),
        getUserDashboard(id),
      ]);

      // Posts
      if (postsRes.statusCode === 200) {
        setPosts(postsRes.data);
      } else {
        showToastMessage(
          toast,
          'danger',
          postsRes?.data?.message || 'Failed to fetch posts'
        );
      }

      // Profile data
      console.log('getUserCredentials response:', userRes);
      if (userRes.statusCode === 200) {
        console.log('User data structure:', userRes.data);
        console.log('Full response structure:', JSON.stringify(userRes, null, 2));
        
        let userDataToSet;
        if (userRes.data && userRes.data.user) {
          userDataToSet = userRes.data.user;
        } else if (userRes.data) {
          userDataToSet = userRes.data;
        } else {
          userDataToSet = userRes;
        }
        
        console.log('Setting user data:', userDataToSet);
        console.log('Profile image URL:', userDataToSet?.image);
        
        // Ensure the image URL is properly formatted
        if (userDataToSet?.image) {
          let formattedImageUrl = userDataToSet.image;
          
          // Remove any whitespace
          formattedImageUrl = formattedImageUrl.trim();
          
          // If it's already a full URL, use as is
          if (formattedImageUrl.startsWith('http://') || formattedImageUrl.startsWith('https://')) {
            console.log('Image URL is already absolute:', formattedImageUrl);
          } else if (formattedImageUrl.startsWith('/')) {
            // If it's a relative URL starting with /
            formattedImageUrl = `http://35.174.167.92:3002${formattedImageUrl}`;
            console.log('Converted relative URL to absolute:', formattedImageUrl);
          } else {
            // If it doesn't start with /, assume it's a relative path
            formattedImageUrl = `http://35.174.167.92:3002/${formattedImageUrl}`;
            console.log('Converted path to absolute URL:', formattedImageUrl);
          }
          
          userDataToSet.image = formattedImageUrl;
          console.log('Final formatted image URL:', formattedImageUrl);
        }
        console.log('Final user data to set:', userDataToSet);
        AsyncStorage.setItem('currentUsername', userDataToSet.displayName);
        setUserData(userDataToSet);
      } else {
        showToastMessage(
          toast,
          'danger',
          userRes?.data?.message || 'Failed to fetch profile'
        );
      }

      // Dashboard
      if (dashRes.statusCode === 200) {
        setUserDashboard(dashRes.data.dashboardData);
      } else {
        showToastMessage(
          toast,
          'danger',
          dashRes?.data?.message || 'Failed to fetch dashboard'
        );
      }
    } catch (error) {
      console.error('Error fetching profile screen data:', error);
      showToastMessage(toast, 'danger', 'Network error');
    } finally {
      dispatch(hideLoader());
    }
  }, [dispatch, toast]);

  // Run on screen focus
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        if (!isActive) return;
        await fetchAllData();
      })();
      return () => {
        isActive = false;
      };
    }, [fetchAllData])
  );

  // Pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true); 
    await fetchAllData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#783eb9a9']}
          />
        }
      >
        <ProfilePersonData
          displayName={userData?.displayName}
          username={userData?.userName}
          profilepic={userData?.image}
          bio={userData?.bio}
          dashboard={userDashboard}
          userData={userData}
          // executeFollowAction={executeFollowAction}
        />
        <View>
          <HighlightStories />
        </View>
        <ProfileTabs post={posts} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f2fd',
    paddingBottom: 20,
  },
  scrollContainer: {
    flexGrow: 1,
  },
});
