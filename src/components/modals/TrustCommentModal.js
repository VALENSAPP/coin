import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import { useLanguage } from '../../i18n';

export default function TrustCommentModal({ visible, voteType, onClose, onSubmit }) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const config = {
    agree: {
      color: '#059669',
      icon: 'thumbs-up',
      label: t('trustCommentModal.agreeLabel'),
      detail: t('trustCommentModal.agreeDetail'),
    },
    not_sure: {
      color: '#F59E0B',
      icon: 'help-circle',
      label: t('trustCommentModal.notSureLabel'),
      detail: t('trustCommentModal.notSureDetail'),
    },
    disagree: {
      color: '#DC2626',
      icon: 'thumbs-down',
      label: t('trustCommentModal.disagreeLabel'),
      detail: t('trustCommentModal.disagreeDetail'),
    },
  };
  const c = config[voteType] || config.disagree;

  const handleSubmit = async () => {
    setLoading(true);
    await onSubmit(comment.trim());
    setLoading(false);
    setComment('');
    onClose();
  };

  const handleSkip = async () => {
    setComment('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <View style={styles.box}>
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.shieldCircle, { backgroundColor: c.color }]}>
                <Feather name={c.icon} size={17} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>
                  {t('trustCommentModal.headerTitle')}
                </Text>
                <Text style={styles.sub}>
                  {t('trustCommentModal.headerSubtitle')}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Icon name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Vote badge */}
            <View style={[styles.badge, { borderColor: c.color + '44', backgroundColor: c.color + '12' }]}>
              <View style={[styles.dot, { backgroundColor: c.color }]} />
              <Text style={[styles.badgeLabel, { color: c.color }]}>
                {c.label} {t('trustCommentModal.voteSuffix')}
              </Text>
              <Text style={[styles.badgeDetail, { color: c.color }]}>{c.detail}</Text>
            </View>

            {/* Comment input */}
            <Text style={styles.sectionLabel}>
              {t('trustCommentModal.sectionLabel')}{' '}
              <Text style={styles.optionalText}>
                {t('trustCommentModal.optional')}
              </Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t('trustCommentModal.inputPlaceholder', {
                label: c.label.toLowerCase(),
              })}
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={280}
              value={comment}
              onChangeText={setComment}
            />
            <Text style={styles.charCount}>
              {t('trustCommentModal.charCount', { count: comment.length })}
            </Text>

            {/* Info note */}
            <View style={styles.infoNote}>
              <Icon name="information-circle-outline" size={14} color="#6B7280" />
              <Text style={styles.infoText}>
                {t('trustCommentModal.infoNote')}
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={loading}>
                <Text style={styles.skipText}>
                  {t('trustCommentModal.skipButton')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: c.color }, loading && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={loading}>
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.submitText}>
                      {t('trustCommentModal.submitButton')}
                    </Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  shieldCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '600', color: '#111827' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, margin: 12, marginBottom: 0, padding: 8, borderWidth: 0.5, borderRadius: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeLabel: { fontSize: 13, fontWeight: '600' },
  badgeDetail: { fontSize: 12, marginLeft: 'auto' },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', padding: 14, paddingBottom: 6 },
  optionalText: { fontWeight: '400', color: '#9CA3AF' },
  input: { marginHorizontal: 14, borderWidth: 0.5, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, height: 80, fontSize: 14, color: '#111827', textAlignVertical: 'top' },
  charCount: { textAlign: 'right', fontSize: 11, color: '#9CA3AF', paddingHorizontal: 14, marginTop: 4 },
  infoNote: { flexDirection: 'row', gap: 6, marginHorizontal: 14, marginTop: 8, padding: 8, backgroundColor: '#F9FAFB', borderRadius: 6, borderLeftWidth: 2, borderLeftColor: '#D1D5DB' },
  infoText: { fontSize: 12, color: '#6B7280', flex: 1, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 10, padding: 16 },
  skipBtn: { flex: 1, padding: 11, borderWidth: 0.5, borderColor: '#D1D5DB', borderRadius: 8, alignItems: 'center' },
  skipText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  submitBtn: { flex: 2, padding: 11, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});