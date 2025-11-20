import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../../theme/useApptheme';
export default function OptionsModal({
  visible,
  onClose,
  onSelect,
  fromHome,
  isSaved = false,
  postId = '',
  canDelete,
  isHidden = false,
  hideBusy = false
}) {
  const sheetRef = useRef();
  const { bgStyle, textStyle } = useAppTheme();

  useEffect(() => {
    if (visible) sheetRef.current?.open();
    else sheetRef.current?.close();
  }, [visible]);

  const tap = (action) => {
    onSelect?.(action, { postId });
    // sheetRef.current?.close();
  };

  return (
    <RBSheet
      ref={sheetRef}
      draggable
      height={280}
      onClose={onClose}
      customModalProps={{ statusBarTranslucent: true }}
      customStyles={{
        container: [
          { borderTopLeftRadius: 10, borderTopRightRadius: 10 },
          bgStyle
        ],
        draggableIcon: { width: 80 }, 
      }}>
      <ScrollView>
        <View style={[styles.mainContainer, bgStyle]}>
          <View style={[styles.innerContainer, bgStyle]}>
            <Pressable style={styles.innerRow} onPress={() => tap('copyAddress')}>
              <FontAwesomeIcon name="copy" size={20} color="#262626" />
              <Text style={styles.innerText}>Copy address</Text>
            </Pressable>

            <Pressable style={styles.innerRow} onPress={() => tap('toggleSave')}>
              <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color="#262626" />
              <Text style={styles.innerText}>{isSaved ? 'Unsave Post' : 'Save Post'}</Text>
            </Pressable>

            {/* <Pressable style={styles.innerRow} onPress={() => tap('openExplorer')}>
              <FontAwesomeIcon name="internet-explorer" size={20} color="#262626" />
              <Text style={styles.innerText}>View in explorer</Text>
            </Pressable>

            <Pressable style={styles.innerRow} onPress={() => tap('openDexscreener')}>
              <MaterialIcons name="screenshot-monitor" size={20} color="#262626" />
              <Text style={styles.innerText}>View on Dexscreener</Text>
            </Pressable> */}
          </View>

          <View style={styles.innerContainer}>
            {
              canDelete &&
              <Pressable style={styles.innerRow} onPress={() => tap('hidePost')}>
                <MaterialIcons name={isHidden ? 'visibility' : 'visibility-off'} size={20} color="#262626" />
                <Text style={styles.innerText}>
                  {hideBusy ? 'Please wait...' : isHidden ? 'Unhide post' : 'Hide post'}
                </Text>
              </Pressable>
            }

            {fromHome && !canDelete ? (
              <>
                <Pressable style={styles.innerRow} onPress={() => tap('muteUser')}>
                  <FontAwesome5Icon name="volume-mute" size={20} color="red" />
                  <Text style={[styles.innerText, { color: 'red' }]}>Mute (username)</Text>
                </Pressable>
                <Pressable style={styles.innerRow} onPress={() => tap('report')}>
                  <MaterialIcons name="report-gmailerrorred" size={20} color="red" />
                  <Text style={[styles.innerText, { color: 'red' }]}>Report</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.innerRow} onPress={() => tap('deletePost')}>
                <MaterialIcons name="delete" size={20} color="red" />
                <Text style={[styles.innerText, { color: 'red' }]}>Delete Post</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </RBSheet>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  innerContainer: {
    padding: 12,
    width: '100%',
    // marginBottom: 5,
    borderRadius: 10,
  },
  innerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginVertical: 7,
    marginLeft: 15,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});