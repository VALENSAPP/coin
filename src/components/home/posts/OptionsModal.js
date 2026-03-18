import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../../theme/useApptheme';
import ReportFlowScreen from '../../modals/Report';
import { HidePost as apiHidePost, unHidePost as apiUnhidePost } from '../../../services/post';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../displaytoastmessage';
export default function OptionsModal({
  visible,
  onClose,
  onSelect,
  fromHome,
  isSaved = false,
  postId = '',
  canDelete = false,
  canEdit = false,
  isHidden = false,
  hideBusy = false,
  onHiddenChange,
  canHide = true,
}) {
  const sheetRef = useRef();
  const { bgStyle, textStyle } = useAppTheme();
  const reportRef = useRef(null);
  const toast = useToast();
  const [localHidden, setLocalHidden] = useState(!!isHidden);
  const [localHideBusy, setLocalHideBusy] = useState(false);

  const effectiveHidden = useMemo(() => localHidden, [localHidden]);
  const effectiveHideBusy = useMemo(() => Boolean(hideBusy || localHideBusy), [hideBusy, localHideBusy]);

  useEffect(() => {
    if (visible) sheetRef.current?.open();
    else sheetRef.current?.close();
  }, [visible]);

  useEffect(() => {
    setLocalHidden(!!isHidden);
  }, [isHidden]);

  const tap = (action) => {
    onSelect?.(action, { postId });
    // sheetRef.current?.close();
  };
  // console.log(postId,'post it sgreaag');
  
  const report = () => {
    sheetRef.current?.close();

    setTimeout(() => {
      reportRef.current?.open();
    }, 300);
  };
  const muteUser = () => {
  sheetRef.current?.close();
  Alert.alert(
    'User Muted',
    'You will no longer receive notifications from this user.'
  );
};

  const handleToggleHide = useCallback(async () => {
    if (!postId) return;
    if (effectiveHideBusy) return;

    const nextHidden = !effectiveHidden;
    setLocalHideBusy(true);
    setLocalHidden(nextHidden);

    try {
      const resp = nextHidden ? await apiHidePost(postId) : await apiUnhidePost(postId);
      const ok = resp?.statusCode === 200 && (resp?.success ?? true);
      if (!ok) {
        setLocalHidden(effectiveHidden);
        showToastMessage(
          toast,
          'danger',
          resp?.data?.message || resp?.message || `Failed to ${nextHidden ? 'hide' : 'unhide'} post`,
        );
        return;
      }
console.log(resp,'repone in hide post')
      showToastMessage(
        toast,
        'success',
        resp?.data?.message || (nextHidden ? 'Post hidden' : 'Post unhidden'),
      );

      onHiddenChange?.(postId, nextHidden);
      sheetRef.current?.close();
    } catch (error) {
      setLocalHidden(effectiveHidden);
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || 'Something went wrong',
      );
    } finally {
      setLocalHideBusy(false);
    }
  }, [effectiveHidden, effectiveHideBusy, onHiddenChange, postId, toast]);

  return (
    <>
      <RBSheet
        ref={sheetRef}
        draggable
        height={canEdit ? 300 : 250}
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
              <TouchableOpacity style={styles.innerRow} onPress={() => tap('copyAddress')}>
                <FontAwesomeIcon name="copy" size={20} color="#262626" />
                <Text style={styles.innerText}>Copy address</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.innerRow} onPress={() => tap('toggleSave')}>
                <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color="#262626" />
                <Text style={styles.innerText}>{isSaved ? 'Unsave Post' : 'Save Post'}</Text>
              </TouchableOpacity>

              {canEdit ? (
                <TouchableOpacity style={styles.innerRow} onPress={() => tap('editPost')}>
                  <MaterialIcons name="edit" size={20} color="#262626" />
                  <Text style={styles.innerText}>Edit Post</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.innerContainer}>
              {
                canHide ? (
                <TouchableOpacity style={styles.innerRow} onPress={handleToggleHide} disabled={effectiveHideBusy}>
                  <MaterialIcons name={effectiveHidden ? 'visibility' : 'visibility-off'} size={20} color="#262626" />
                  <Text style={styles.innerText}>
                    {effectiveHideBusy ? 'Please wait...' : effectiveHidden ? 'Unhide post' : 'Hide post'}
                  </Text>
                </TouchableOpacity>
                ) : null
              }

              {fromHome && !canDelete ? (
                <>
                  {/* <TouchableOpacity style={styles.innerRow} onPress={muteUser}>
                    <FontAwesome5Icon name="volume-mute" size={20} color="red" />
                    <Text style={[styles.innerText, { color: 'red' }]}>Mute (username)</Text>
                  </TouchableOpacity> */}
                  <TouchableOpacity style={styles.innerRow} onPress={report}>
                    <MaterialIcons name="report-gmailerrorred" size={20} color="red" />
                    <Text style={[styles.innerText, { color: 'red' }]}>Report</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.innerRow} onPress={() => tap('deletePost')}>
                  <MaterialIcons name="delete" size={20} color="red" />
                  <Text style={[styles.innerText, { color: 'red' }]}>Delete Post</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </RBSheet>
      <ReportFlowScreen ref={reportRef} />
    </>
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
