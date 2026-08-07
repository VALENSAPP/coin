import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'react-native-toast-notifications';
import { getMessagesPrivateById, updateMessages } from '../../services/post';
import { showToastMessage } from '../displaytoastmessage';

const { width: screenWidth } = Dimensions.get('window');

const PrivateContentHeader = ({
  message: initialMessage = '',
  messageType = null, // 'photos' | 'videos' | 'ebooks'
  canEdit = false,
  onSave = () => {},
  placeholder = 'Add a message for private content',
  userId = null,
  profileType,
  style,
}) => {
  const [message, setMessage] = useState(initialMessage || '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message);
  const [isMessageExpanded, setIsMessageExpanded] = useState(false);
  const [isMessageTruncated, setIsMessageTruncated] = useState(false);
  const [serverMessages, setServerMessages] = useState({
    messageForPhotos: '',
    messageForVideos: '',
    messageForEbooks: '',
  });
  const { bg, card, text, mutedText, accent } = useAppTheme(profileType);
  const { isDarkMode } = useThemeContext();
  const toast = useToast();

  useEffect(() => setMessage(initialMessage || ''), [initialMessage]);

  // Reset the collapsed state whenever this tab receives a different message.
  useEffect(() => {
    setIsMessageExpanded(false);
    setIsMessageTruncated(false);
  }, [message, messageType]);

  const iconName = (messageType === 'photos') ? 'images-outline' : (messageType === 'videos' || messageType === 'video') ? 'videocam-outline' : 'book-outline';

  useEffect(() => {
    let mounted = true;
    const fetchServer = async () => {
      if (!userId) return;
      try {
        const res = await getMessagesPrivateById({ params: { userId } });
        const payload = res?.data?.data ?? res?.data ?? res;
        const next = {
          messageForPhotos: payload?.messageForPhotos || payload?.messageForPhoto || '',
          messageForVideos: payload?.messageForVideos || payload?.messageForVideo || '',
          messageForEbooks: payload?.messageForEbooks || payload?.messageForEbook || '',
        };
        if (mounted) {
          setServerMessages(next);
          if (messageType) {
            const map = {
              photos: next.messageForPhotos,
              video: next.messageForVideos,
              videos: next.messageForVideos,
              ebook: next.messageForEbooks,
              ebooks: next.messageForEbooks,
            };
            const val = map[messageType] ?? '';
            if (val) setMessage(val);
          }
        }
      } catch (e) {
        // ignore server error — fallback to AsyncStorage handled elsewhere
        console.log('getMessagesPrivateById error', e?.response || e?.message || e);
      }
    };
    fetchServer();
    return () => { mounted = false; };
  }, [userId, messageType]);

  const getCustomMessageKey = (userId, type) => `privateMessage:${type}:${userId || 'unknown'}`;

  useEffect(() => {
    let mounted = true;
    const loadForUser = async () => {
      if (!messageType) return;
      try {
        const targetUserId = userId || await AsyncStorage.getItem('userId');
        let serverVal = '';
        if (targetUserId) {
          try {
            const res = await getMessagesPrivateById({ params: { userId: targetUserId } });
            const payload = res?.data?.data ?? res?.data ?? res;
            const next = {
              messageForPhotos: payload?.messageForPhotos || payload?.messageForPhoto || '',
              messageForVideos: payload?.messageForVideos || payload?.messageForVideo || '',
              messageForEbooks: payload?.messageForEbooks || payload?.messageForEbook || '',
            };
            if (mounted) setServerMessages(next);
            const map = {
              photos: next.messageForPhotos,
              videos: next.messageForVideos,
              video: next.messageForVideos,
              ebook: next.messageForEbooks,
              ebooks: next.messageForEbooks,
            };
            serverVal = map[messageType] ?? '';
          } catch (err) {
            serverVal = '';
          }
        }

        if (mounted) {
          if (serverVal && serverVal.length > 0) {
            setMessage(serverVal);
            return;
          }

          const keyOwner = targetUserId || 'unknown';
          const key = getCustomMessageKey(keyOwner, messageType);
          const stored = await AsyncStorage.getItem(key);
          if (mounted && stored) setMessage(stored);
        }
      } catch (e) {
        // noop
      }
    };
    loadForUser();
    return () => { mounted = false; };
  }, [messageType, initialMessage, userId]);

  const handleSave = () => {
    setMessage(draft || '');
    setEditing(false);
    try {
      onSave(draft || '');
      // persist locally by user
      if (messageType) {
        (async () => {
          try {
            const userId = await AsyncStorage.getItem('userId');
            const key = getCustomMessageKey(userId, messageType);
            await AsyncStorage.setItem(key, draft || '');
            // update server if owner
            if (canEdit) {
              const next = { ...serverMessages };
              if (messageType === 'photos') next.messageForPhotos = draft || '';
              if (messageType === 'videos' || messageType === 'video') next.messageForVideos = draft || '';
              if (messageType === 'ebooks' || messageType === 'ebook') next.messageForEbooks = draft || '';
              try {
                await updateMessages(next);
                setServerMessages(next);
                showToastMessage(toast, 'success', 'Message updated');
              } catch (err) {
                console.log('updateMessages error', err?.response || err?.message || err);
                showToastMessage(toast, 'danger', 'Failed to update message on server');
              }
            }
          } catch (e) {
            // noop
          }
        })();
      }
    } catch (e) {
      // noop
    }
  };

  const displayedMessage = message && message.length > 0
    ? message
    : (canEdit ? placeholder : 'No message added');

  const handleMessageLayout = ({ nativeEvent }) => {
    // `lines` contains the natural line layout, allowing us to show the control
    // only when the message genuinely needs more than the two-line preview.
    setIsMessageTruncated(nativeEvent.lines.length > 2);
  };

  return (
    <View style={[styles.root, { backgroundColor: bg }, style]}>
      <View style={[styles.card, { backgroundColor: card, borderColor: 'rgba(0,0,0,0.06)' }]}> 
        <View style={styles.iconWrap}>
          <View style={[styles.iconBubble, { backgroundColor: `${accent}22` }]}> 
            <Ionicons name={iconName} size={18} color={accent || '#5A2D82'} />
          </View>
        </View>
        <View style={styles.body}>
          <TouchableOpacity
            activeOpacity={isMessageTruncated ? 0.7 : 1}
            disabled={!isMessageTruncated}
            onPress={() => setIsMessageExpanded((expanded) => !expanded)}
            accessibilityRole={isMessageTruncated ? 'button' : undefined}
            accessibilityLabel={isMessageTruncated ? (isMessageExpanded ? 'Collapse private content message' : 'Expand private content message') : undefined}
            accessibilityState={isMessageTruncated ? { expanded: isMessageExpanded } : undefined}
          >
            <Text
              style={[styles.messageText, { color: mutedText }]}
              numberOfLines={isMessageExpanded ? undefined : 2}
              ellipsizeMode="tail"
            >
              {displayedMessage}
            </Text>
            {isMessageTruncated && (
              <Text style={[styles.expandToggle, { color: accent || '#5A2D82' }]}>
                {isMessageExpanded ? 'Show less' : 'Show more'}
              </Text>
            )}
          </TouchableOpacity>
          <Text
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[styles.messageText, styles.messageMeasure]}
            onTextLayout={handleMessageLayout}
          >
            {displayedMessage}
          </Text>
        </View>
        {canEdit && (
          <TouchableOpacity style={styles.editButton} onPress={() => { setDraft(message || ''); setEditing(true); }}>
            <Ionicons name="pencil" size={18} color={accent || '#5A2D82'} />
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={editing}
        animationType="slide"
        transparent
        onRequestClose={() => setEditing(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.4)' }]}>
          <View style={[styles.modalCard, { backgroundColor: card, borderColor: 'rgba(0,0,0,0.06)' }]}> 
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.modalTitleBold, { color: text }]}>Edit message</Text>
                <Text style={[styles.modalSubtitle, { color: mutedText }]}>For {messageType || 'private content'}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditing(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={mutedText} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={placeholder}
              placeholderTextColor={mutedText}
              multiline
              style={[styles.textInput, { color: text, borderColor: 'rgba(0,0,0,0.06)' }]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton]} onPress={() => setEditing(false)}>
                <Text style={[styles.modalButtonText, { color: mutedText }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: accent }]} onPress={handleSave}>
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default PrivateContentHeader;

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  messageText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  messageMeasure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
  expandToggle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },
  editButton: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: Math.min(screenWidth - 40, 640),
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
  },
  modalTitleBold: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  textInput: {
    minHeight: 96,
    maxHeight: 240,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
