import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import DatePicker from 'react-native-date-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import { createBattle } from '../../services/battle';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';

const PRIMARY_GRADIENT = ['#513189bd', '#e54ba0'];
const BORDER = '#D1D5DB';
const SOFT = '#EEF2FF';
const MUTED = '#6B7280';
const ERROR = '#DC2626';

const createInitialForm = () => ({
  format: 'POLL',
  question: '',
  options: ['', ''],
  endTime: null,
  isPublic: true,
  invitedUserId: '',
  stake: '',
});

const formatDisplayDate = value => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export default function OpenBattleScreen() {
  const navigation = useNavigation();
  const toast = useToast();
  const { bgStyle, text, card } = useAppTheme();
  const [form, setForm] = useState(createInitialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const inputBackground = card || '#FFFFFF';
  const isPoll = form.format === 'POLL';
  const isHeadToHead = form.format === 'HEAD_TO_HEAD';

  const formatOptions = useMemo(
    () => [
      {
        key: 'POLL',
        title: 'Battle Poll',
        subtitle: 'Add question and answer options',
      },
      {
        key: 'HEAD_TO_HEAD',
        title: 'Head to Head',
        subtitle: 'Add question and invite another user',
      },
    ],
    [],
  );

  const updateField = (field, value) => {
    setForm(prev => {
      if (field === 'format') {
        return {
          ...prev,
          format: value,
          invitedUserId: value === 'HEAD_TO_HEAD' ? prev.invitedUserId : '',
          options: value === 'POLL' ? prev.options : ['', ''],
        };
      }

      if (field === 'isPublic') {
        return {
          ...prev,
          isPublic: value,
        };
      }

      return {
        ...prev,
        [field]: value,
      };
    });

    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const updateOption = (index, value) => {
    setForm(prev => {
      const options = [...prev.options];
      options[index] = value;
      return {
        ...prev,
        options,
      };
    });

    setErrors(prev => {
      const next = { ...prev };
      delete next.options;
      return next;
    });
  };

  const addOption = () => {
    setForm(prev => ({
      ...prev,
      options: [...prev.options, ''],
    }));
  };

  const removeOption = index => {
    setForm(prev => {
      if (prev.options.length <= 2) {
        return prev;
      }

      return {
        ...prev,
        options: prev.options.filter((_, currentIndex) => currentIndex !== index),
      };
    });
  };

  const validate = () => {
    const nextErrors = {};
    const question = form.question.trim();
    const invitedUserId = form.invitedUserId.trim();
    const options = form.options.map(option => option.trim()).filter(Boolean);

    if (!question) {
      nextErrors.question = 'Question is required';
    }

    if (isPoll && options.length < 2) {
      nextErrors.options = 'Please add at least 2 options';
    }

    if (!form.endTime) {
      nextErrors.endTime = 'End time is required';
    }

    if (form.endTime && new Date(form.endTime) <= new Date()) {
      nextErrors.endTime = 'End time must be in the future';
    }

    if (isHeadToHead && !invitedUserId) {
      nextErrors.invitedUserId = 'Please add the user you want to invite';
    }

    if (form.stake && Number.isNaN(Number(form.stake))) {
      nextErrors.stake = 'Stake must be a valid number';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      showToastMessage(toast, 'danger', 'Please fix the highlighted fields.');
      return;
    }

    const payload = {
      format: form.format,
      question: form.question,
      endTime: new Date(form.endTime).toISOString(),
      isPublic: form.isPublic,
    };

    if (isPoll) {
      payload.options = form.options.map(option => option.trim()).filter(Boolean);
    }

    if (isHeadToHead) {
      payload.invitedUserId = form.invitedUserId.trim();
    }

    if (form.stake !== '' && !Number.isNaN(Number(form.stake))) {
      payload.stake = Number(form.stake);
    }

    setSubmitting(true);

    try {
      const response = await createBattle(payload);

      if (
        (response?.statusCode >= 200 && response?.statusCode < 300) ||
        response?.success ||
        response?.error === false
      ) {
        showToastMessage(toast, 'success', response?.message || 'Battle created successfully');
        setForm(createInitialForm());
        setErrors({});
        navigation.goBack();
        return;
      }

      showToastMessage(toast, 'danger', response?.message || 'Failed to create battle');
    } catch (error) {
      showToastMessage(toast, 'danger', error?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn}>
            <Ionicons name="chevron-back" size={24} color={text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: text }]}>Create Battle</Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Battle Format',
                'Poll needs question and options. Head to head needs question and the invited user id.',
              )
            }
            style={styles.headerIconBtn}
          >
            <Ionicons name="help-circle-outline" size={22} color={text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.illustration}>
              <Ionicons name="trophy-outline" size={30} color="#7C3AED" />
            </View>
            <Text style={[styles.heroTitle, { color: text }]}>Set up your battle</Text>
            <Text style={styles.heroSubtitle}>
              Choose the format, add the required details, and publish.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: text }]}>Battle Format</Text>
            <View style={styles.formatRow}>
              {formatOptions.map(option => {
                const isSelected = form.format === option.key;
                const Wrapper = isSelected ? LinearGradient : View;
                const wrapperProps = isSelected
                  ? { colors: PRIMARY_GRADIENT, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }
                  : {};

                return (
                  <TouchableOpacity
                    key={option.key}
                    style={styles.formatCell}
                    onPress={() => updateField('format', option.key)}
                    activeOpacity={0.88}
                  >
                    <Wrapper
                      {...wrapperProps}
                      style={[
                        styles.formatCard,
                        !isSelected && { backgroundColor: SOFT, borderColor: BORDER },
                      ]}
                    >
                      <Text style={[styles.formatTitle, { color: isSelected ? '#fff' : '#111827' }]}>
                        {option.title}
                      </Text>
                      <Text
                        style={[styles.formatSubtitle, { color: isSelected ? '#F3F4F6' : MUTED }]}
                      >
                        {option.subtitle}
                      </Text>
                    </Wrapper>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: text }]}>Question</Text>
            <TextInput
              style={[
                styles.input,
                styles.questionInput,
                {
                  backgroundColor: inputBackground,
                  color: text,
                  borderColor: errors.question ? ERROR : BORDER,
                },
              ]}
              placeholder="Write your battle question"
              placeholderTextColor={MUTED}
              multiline
              value={form.question}
              onChangeText={value => updateField('question', value)}
            />
            {!!errors.question && <Text style={styles.errorText}>{errors.question}</Text>}
          </View>

          {isPoll && (
            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <Text style={[styles.label, { color: text }]}>Options</Text>
                <TouchableOpacity onPress={addOption}>
                  <Text style={styles.addOptionText}>+ Add Option</Text>
                </TouchableOpacity>
              </View>

              {form.options.map((option, index) => (
                <View key={`option-${index}`} style={styles.optionRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.optionInput,
                      {
                        backgroundColor: inputBackground,
                        color: text,
                        borderColor: errors.options ? ERROR : BORDER,
                      },
                    ]}
                    placeholder={`Option ${index + 1}`}
                    placeholderTextColor={MUTED}
                    value={option}
                    onChangeText={value => updateOption(index, value)}
                  />
                  <TouchableOpacity
                    onPress={() => removeOption(index)}
                    disabled={form.options.length <= 2}
                    style={styles.removeBtn}
                  >
                    <Ionicons
                      name="close-circle"
                      size={24}
                      color={form.options.length <= 2 ? '#CBD5E1' : '#EF4444'}
                    />
                  </TouchableOpacity>
                </View>
              ))}

              {!!errors.options && <Text style={styles.errorText}>{errors.options}</Text>}
            </View>
          )}

          {isHeadToHead && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: text }]}>Invited User ID</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBackground,
                    color: text,
                    borderColor: errors.invitedUserId ? ERROR : BORDER,
                  },
                ]}
                placeholder="Add the user id you want to invite"
                placeholderTextColor={MUTED}
                value={form.invitedUserId}
                onChangeText={value => updateField('invitedUserId', value)}
              />
              <Text style={styles.helperText}>
                Head to head needs the other user you want to challenge.
              </Text>
              {!!errors.invitedUserId && <Text style={styles.errorText}>{errors.invitedUserId}</Text>}
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.label, { color: text }]}>End Time</Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.dateInput,
                {
                  backgroundColor: inputBackground,
                  borderColor: errors.endTime ? ERROR : BORDER,
                },
              ]}
              onPress={() => setDatePickerOpen(true)}
            >
              <Text style={[styles.dateText, { color: form.endTime ? text : MUTED }]}>
                {form.endTime ? formatDisplayDate(form.endTime) : 'Select end time'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={MUTED} />
            </TouchableOpacity>
            {!!errors.endTime && <Text style={styles.errorText}>{errors.endTime}</Text>}
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: text }]}>Stake (Optional)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputBackground,
                  color: text,
                  borderColor: errors.stake ? ERROR : BORDER,
                },
              ]}
              placeholder="0"
              placeholderTextColor={MUTED}
              keyboardType="numeric"
              value={form.stake}
              onChangeText={value => updateField('stake', value)}
            />
            {!!errors.stake && <Text style={styles.errorText}>{errors.stake}</Text>}
          </View>

          <View style={styles.section}>
            <View style={[styles.publicCard, { backgroundColor: inputBackground, borderColor: BORDER }]}>
              <View style={styles.publicCopy}>
                <Text style={[styles.label, { color: text, marginBottom: 4 }]}>Public Battle</Text>
                <Text style={styles.helperText}>
                  Keep this on to create a public battle.
                </Text>
              </View>
              <Switch
                value={form.isPublic}
                onValueChange={value => updateField('isPublic', value)}
                trackColor={{ false: '#CBD5E1', true: '#C4B5FD' }}
                thumbColor={form.isPublic ? '#7C3AED' : '#F8FAFC'}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={handleSubmit} disabled={submitting} activeOpacity={0.9}>
            <LinearGradient
              colors={PRIMARY_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createBtn}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createBtnText}>CREATE BATTLE</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <DatePicker
          modal
          mode="datetime"
          open={datePickerOpen}
          date={form.endTime || new Date(Date.now() + 60 * 60 * 1000)}
          minimumDate={new Date()}
          onCancel={() => setDatePickerOpen(false)}
          onConfirm={date => {
            updateField('endTime', date);
            setDatePickerOpen(false);
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  illustration: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    textAlign: 'center',
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formatCell: {
    flex: 1,
  },
  formatCard: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    minHeight: 82,
  },
  formatTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  formatSubtitle: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  questionInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addOptionText: {
    color: '#7C3AED',
    fontWeight: '800',
    fontSize: 13,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  optionInput: {
    flex: 1,
  },
  removeBtn: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 6,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  publicCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  publicCopy: {
    flex: 1,
  },
  errorText: {
    color: ERROR,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  bottomBar: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  createBtn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom:'15%'
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 1,
  },
});
