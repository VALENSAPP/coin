import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';

const { width } = Dimensions.get('window');

const TopHoldersModal = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState(0); // Initialize with 0
  const sheetRef = useRef(null); // Separate ref for RBSheet
  const scrollViewRef = useRef(null); // Separate ref for ScrollView

  useEffect(() => {
    if (visible && sheetRef.current) {
      sheetRef.current?.open();
      // Reset to first tab when modal opens
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ x: 0, animated: false });
          setActiveTab(0);
        }
      }, 100);
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const handleTabPress = (index) => {
    setActiveTab(index);
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: width * index, animated: true });
    }
  };

  const handleScroll = (event) => {
    const pageIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveTab(pageIndex);
  };

  const handleClose = () => {
    // Reset state when closing
    setActiveTab(0);
    onClose();
  };

  return (
    <RBSheet
      ref={sheetRef}
      draggable
      height={330}
      onClose={handleClose}
      customModalProps={{
        statusBarTranslucent: true,
      }}
      customStyles={{
        container: {
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
           backgroundColor: '#f8f2fd',
        },
        draggableIcon: {
          width: 80,
        },
      }}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity style={styles.tab} onPress={() => handleTabPress(0)}>
              <Text style={[styles.tabText, activeTab === 0 && styles.activeTabText]}>
                Activity
              </Text>
              {activeTab === 0 && <View style={styles.activeUnderline} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.tab} onPress={() => handleTabPress(1)}>
              <Text style={[styles.tabText, activeTab === 1 && styles.activeTabText]}>
                Holders
              </Text>
              {activeTab === 1 && <View style={styles.activeUnderline} />}
            </TouchableOpacity>
          </View>

          {/* Content with swipe */}
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {/* Activity Page */}
            <View style={[styles.page, { width }]}>
              <View style={styles.centerContent}>
                <Text style={styles.noActivityText}>✨ No activity yet</Text>
                <Text style={styles.subText}>Buy to get the market started</Text>
                <TouchableOpacity style={styles.buyButton}>
                  <Text style={styles.buyButtonText}>Buy</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Holders Page */}
            <View style={[styles.page, { width }]}>
              <View style={styles.holdersWrapper}>
                {/* Top two boxes */}
                <View style={styles.topBoxes}>
                  <View style={styles.box}>
                    <Text style={styles.boxTitle}>Market</Text>
                    <Text style={styles.boxPercent}>50%</Text>
                  </View>
                  <View style={styles.box}>
                    <Text style={styles.boxTitle}>User</Text>
                    <Text style={styles.boxPercent}>50%</Text>
                  </View>
                </View>

                {/* List row */}
                <View style={styles.holderRow}>
                  <Image
                    source={{ uri: 'https://placehold.co/40x40' }}
                    style={styles.avatar}
                  />
                  <Text style={styles.holderName}>User (you)</Text>
                  <View style={styles.percentBadge}>
                    <Text style={styles.percentText}>0.191%</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </RBSheet>
  );
};

export default TopHoldersModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  modalContainer: {
     backgroundColor: '#f8f2fd',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 10,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 18,
    color: '#888',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#000',
  },
  activeUnderline: {
    width: '100%',
    height: 2,
    backgroundColor: '#000',
    marginTop: 4,
  },
  page: {
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  centerContent: {
    alignItems: 'center',
    marginTop: 40,
  },
  noActivityText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  subText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  buyButton: {
    backgroundColor: '#00D42E',
    borderRadius: 20,
    paddingHorizontal: 30,
    paddingVertical: 10,
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  holdersWrapper: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  topBoxes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  box: {
    backgroundColor: '#f8f2fd',
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  boxTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  boxPercent: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  holderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  holderName: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  percentBadge: {
    backgroundColor: '#00D42E',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  percentText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});