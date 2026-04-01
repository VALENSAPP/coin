import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import { createBattle } from '../../services/battle';
import { getAllUser } from '../../services/users';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';

const PRIMARY_GRADIENT = ['#513189bd', '#e54ba0'];
const BORDER = '#D1D5DB';
const SOFT = '#EEF2FF';
const MUTED = '#6B7280';
const ERROR = '#DC2626';

const createInitialForm = () => ({
  format: 'POLL',
  battleType: 'OPINION',
  question: '',
  options: ['', ''],
  endTime: null,
  isPublic: true,
  invitedUserId: '',
  stake: '',
  creatorChoice: '',
});

const pickFirst = (...values) =>
  values.find(value => value !== undefined && value !== null && value !== '');

const getFilledOptions = options =>
  (Array.isArray(options) ? options : [])
    .map(option => option.trim())
    .filter(Boolean);

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
  const route = useRoute();
 

  const toast = useToast();
  const { bgStyle, text, card } = useAppTheme();
  const [form, setForm] = useState(createInitialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [inviteSearchText, setInviteSearchText] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState([]);
  const [inviteSearchLoading, setInviteSearchLoading] = useState(false);
  const [selectedInviteUser, setSelectedInviteUser] = useState(null);
  const inviteSearchTimeoutRef = useRef(null);

  const inputBackground = card || '#FFFFFF';
  const isPoll = form.format === 'POLL';
  const isHeadToHead = form.format === 'HEAD_TO_HEAD';
  const filledOptions = useMemo(
    () => getFilledOptions(form.options),
    [form.options],
  );
  const lockedOpponentChoice = useMemo(() => {
    if (filledOptions.length < 2 || !form.creatorChoice) {
      return '';
    }

    return filledOptions.find(option => option !== form.creatorChoice) || '';
  }, [filledOptions, form.creatorChoice]);
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

  const battleTypeOptions = useMemo(
    () => [
      {
        key: 'OPINION',
        title: 'Opinion Battle',
        subtitle: 'Winner by votes and engagement',
      },
      {
        key: 'PREDICTION',
        title: 'Prediction Battle',
        subtitle: 'Winner by outcome accuracy first',
      },
    ],
    [],
  );

  useEffect(() => {
    if (!route?.params) {
      return;
    }

    const routeInviteUser = route.params.invitedUser;
    if (routeInviteUser) {
      const normalizedInviteUser = {
        id: String(
          pickFirst(
            routeInviteUser?.id,
            routeInviteUser?._id,
            routeInviteUser?.userId,
            route.params.invitedUserId,
            '',
          ),
        ),
        name: pickFirst(
          routeInviteUser?.name,
          routeInviteUser?.displayName,
          routeInviteUser?.fullName,
          routeInviteUser?.userName,
          'User',
        ),
        userName: pickFirst(
          routeInviteUser?.userName,
          routeInviteUser?.username,
          '',
        ),
        avatar: pickFirst(
          routeInviteUser?.avatar,
          routeInviteUser?.image,
          routeInviteUser?.profilePicture,
          '',
        ),
      };

      if (normalizedInviteUser.id) {
        setSelectedInviteUser(normalizedInviteUser);
        setInviteSearchText(
          normalizedInviteUser.userName
            ? `@${normalizedInviteUser.userName}`
            : normalizedInviteUser.name,
        );
      }
    }

    setForm(prev => ({
      ...prev,
      format: route.params.presetFormat || prev.format,
      invitedUserId:
        route.params.invitedUserId ||
        route.params.invitedUser?.id ||
        prev.invitedUserId,
    }));
  }, [route?.params]);

  useEffect(() => {
    return () => {
      if (inviteSearchTimeoutRef.current) {
        clearTimeout(inviteSearchTimeoutRef.current);
      }
    };
  }, []);

  const searchInviteUsers = async searchQuery => {
    if (!searchQuery.trim()) {
      setInviteSearchResults([]);
      setInviteSearchLoading(false);
      return;
    }

    setInviteSearchLoading(true);
    try {
      const response = await getAllUser({ userName: searchQuery.trim() });
      if (response?.statusCode === 200 || response?.status === 200) {
        setInviteSearchResults(
          Array.isArray(response?.data?.users) ? response.data.users : [],
        );
      } else {
        setInviteSearchResults([]);
      }
    } catch (error) {
      setInviteSearchResults([]);
    } finally {
      setInviteSearchLoading(false);
    }
  };

  const handleInviteSearchChange = value => {
    setInviteSearchText(value);
    setSelectedInviteUser(null);
    updateField('invitedUserId', '');

    if (inviteSearchTimeoutRef.current) {
      clearTimeout(inviteSearchTimeoutRef.current);
    }

    if (!value.trim()) {
      setInviteSearchResults([]);
      setInviteSearchLoading(false);
      return;
    }

    inviteSearchTimeoutRef.current = setTimeout(() => {
      searchInviteUsers(value);
    }, 400);
  };

  const handleSelectInviteUser = user => {
    const nextUser = {
      id: String(pickFirst(user?.id, user?._id, user?.userId, '')),
      name: pickFirst(
        user?.name,
        user?.displayName,
        user?.fullName,
        user?.userName,
        'User',
      ),
      userName: pickFirst(user?.userName, user?.username, ''),
      avatar: pickFirst(user?.image, user?.avatar, user?.profilePicture, ''),
    };

    setSelectedInviteUser(nextUser);
    setInviteSearchText(
      nextUser.userName ? `@${nextUser.userName}` : nextUser.name,
    );
    setInviteSearchResults([]);
    updateField('invitedUserId', nextUser.id);
  };

  const updateField = (field, value) => {
    setForm(prev => {
      if (field === 'format') {
        return {
          ...prev,
          format: value,
          invitedUserId: value === 'HEAD_TO_HEAD' ? prev.invitedUserId : '',
          options: value === 'POLL' ? prev.options : ['', ''],
          creatorChoice: value === 'HEAD_TO_HEAD' ? prev.creatorChoice : '',
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
        options: prev.options.filter(
          (_, currentIndex) => currentIndex !== index,
        ),
      };
    });
  };

  const renderInviteUserRow = user => {
    const userId = String(pickFirst(user?.id, user?._id, user?.userId, ''));
    const name = pickFirst(
      user?.name,
      user?.displayName,
      user?.fullName,
      user?.userName,
      'User',
    );
    const userName = pickFirst(user?.userName, user?.username, '');
    const avatar = pickFirst(
      user?.image,
      user?.avatar,
      user?.profilePicture,
      '',
    );

    return (
      <TouchableOpacity
        key={userId || `${name}-${userName}`}
        activeOpacity={0.85}
        style={[
          styles.userResultCard,
          { backgroundColor: inputBackground, borderColor: BORDER },
        ]}
        onPress={() => handleSelectInviteUser(user)}
      >
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.userAvatar} />
        ) : (
          <View style={styles.userAvatarFallback}>
            <Ionicons name="person-outline" size={18} color="#FFFFFF" />
          </View>
        )}
        <View style={styles.userCopy}>
          <Text style={[styles.userName, { color: text }]} numberOfLines={1}>
            {name}
          </Text>
          {!!userName && (
            <Text style={styles.userHandle} numberOfLines={1}>
              @{userName}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const validate = () => {
    const nextErrors = {};
    const question = form.question.trim();
    const invitedUserId = form.invitedUserId.trim();
    const options = getFilledOptions(form.options);

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

    if (isHeadToHead && options.length < 2) {
      nextErrors.options = 'Please add 2 battle sides for head-to-head';
    }

    if (isHeadToHead && !form.creatorChoice) {
      nextErrors.creatorChoice = 'Choose your side first';
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
      battleType: form.battleType,
      question: form.question,
      endTime: new Date(form.endTime).toISOString(),
      isPublic: form.isPublic,
    };

    if (isPoll) {
      payload.options = filledOptions;
    }

    if (isHeadToHead) {
      payload.invitedUserId = form.invitedUserId.trim();
      payload.options = filledOptions;
      payload.creatorChoice = form.creatorChoice;
      payload.creatorLockedOption = form.creatorChoice;
      payload.invitedUserChoice = lockedOpponentChoice;
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
        showToastMessage(
          toast,
          'success',
          response?.message || 'Battle created successfully',
        );
        setForm(createInitialForm());
        setErrors({});
        navigation.replace('BattleInProgress', {
          battleId:
            response?.data?.battle?.id ||
            response?.data?.battle?._id ||
            response?.data?.id ||
            response?.data?._id ||
            '',
          battle: response?.data?.battle || response?.data || payload,
          entryPoint: 'open_battle',
        });
        return;
      }

      showToastMessage(
        toast,
        'danger',
        response?.message || 'Failed to create battle',
      );
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.message || 'Something went wrong',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        // keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 80}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerIconBtn}
          >
            <Ionicons name="chevron-back" size={24} color={text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: text }]}>
            Create Battle
          </Text>
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

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.illustration}>
              <Ionicons name="trophy-outline" size={30} color="#7C3AED" />
            </View>
            <Text style={[styles.heroTitle, { color: text }]}>
              Set up your battle
            </Text>
            <Text style={styles.heroSubtitle}>
              Choose the format, add the required details, and publish.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: text }]}>
              Battle Format
            </Text>
            <View style={styles.formatRow}>
              {formatOptions.map(option => {
                const isSelected = form.format === option.key;
                const Wrapper = isSelected ? LinearGradient : View;
                const wrapperProps = isSelected
                  ? {
                    colors: PRIMARY_GRADIENT,
                    start: { x: 0, y: 0 },
                    end: { x: 1, y: 0 },
                  }
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
                        !isSelected && {
                          backgroundColor: SOFT,
                          borderColor: BORDER,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.formatTitle,
                          { color: isSelected ? '#fff' : '#111827' },
                        ]}
                      >
                        {option.title}
                      </Text>
                      <Text
                        style={[
                          styles.formatSubtitle,
                          { color: isSelected ? '#F3F4F6' : MUTED },
                        ]}
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
            <Text style={[styles.sectionTitle, { color: text }]}>
              Winner Logic
            </Text>
            <View style={styles.formatRow}>
              {battleTypeOptions.map(option => {
                const isSelected = form.battleType === option.key;
                const Wrapper = isSelected ? LinearGradient : View;
                const wrapperProps = isSelected
                  ? {
                    colors: PRIMARY_GRADIENT,
                    start: { x: 0, y: 0 },
                    end: { x: 1, y: 0 },
                  }
                  : {};

                return (
                  <TouchableOpacity
                    key={option.key}
                    style={styles.formatCell}
                    onPress={() => updateField('battleType', option.key)}
                    activeOpacity={0.88}
                  >
                    <Wrapper
                      {...wrapperProps}
                      style={[
                        styles.formatCard,
                        !isSelected && {
                          backgroundColor: SOFT,
                          borderColor: BORDER,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.formatTitle,
                          { color: isSelected ? '#fff' : '#111827' },
                        ]}
                      >
                        {option.title}
                      </Text>
                      <Text
                        style={[
                          styles.formatSubtitle,
                          { color: isSelected ? '#F3F4F6' : MUTED },
                        ]}
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
            {!!errors.question && (
              <Text style={styles.errorText}>{errors.question}</Text>
            )}
          </View>

          {(isPoll || isHeadToHead) && (
            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <Text style={[styles.label, { color: text }]}>
                  {isHeadToHead ? 'Battle Sides' : 'Options'}
                </Text>
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
                    placeholder={
                      isHeadToHead ? `Side ${index + 1}` : `Option ${index + 1}`
                    }
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

              {!!errors.options && (
                <Text style={styles.errorText}>{errors.options}</Text>
              )}
              {isHeadToHead ? (
                <Text style={styles.helperText}>
                  Add the two sides for this duel, then choose which side you
                  are taking.
                </Text>
              ) : null}
            </View>
          )}

          {isHeadToHead && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: text }]}>Invite User</Text>
              <View
                style={[
                  styles.searchInputWrap,
                  {
                    backgroundColor: inputBackground,
                    borderColor: errors.invitedUserId ? ERROR : BORDER,
                  },
                ]}
              >
                <Ionicons name="search" size={18} color={MUTED} />
                <TextInput
                  style={[styles.searchInput, { color: text }]}
                  placeholder="Search username"
                  placeholderTextColor={MUTED}
                  value={inviteSearchText}
                  onChangeText={handleInviteSearchChange}
                />
              </View>
              <Text style={styles.helperText}>
                Head to head needs the other user you want to challenge. Select
                a user and we will use that user id for the invite.
              </Text>
              {!!errors.invitedUserId && (
                <Text style={styles.errorText}>{errors.invitedUserId}</Text>
              )}

              {selectedInviteUser ? (
                <View
                  style={[
                    styles.selectedUserCard,
                    { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
                  ]}
                >
                  <View style={styles.selectedUserInfo}>
                    {selectedInviteUser.avatar ? (
                      <Image
                        source={{ uri: selectedInviteUser.avatar }}
                        style={styles.userAvatar}
                      />
                    ) : (
                      <View style={styles.userAvatarFallback}>
                        <Ionicons
                          name="person-outline"
                          size={18}
                          color="#FFFFFF"
                        />
                      </View>
                    )}
                    <View style={styles.userCopy}>
                      <Text style={styles.selectedUserTitle}>
                        {selectedInviteUser.name}
                      </Text>
                      {!!selectedInviteUser.userName && (
                        <Text style={styles.selectedUserSubtitle}>
                          @{selectedInviteUser.userName}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedInviteUser(null);
                      setInviteSearchText('');
                      updateField('invitedUserId', '');
                    }}
                  >
                    <Ionicons name="close-circle" size={22} color="#7C3AED" />
                  </TouchableOpacity>
                </View>
              ) : null}

              {!selectedInviteUser && inviteSearchLoading ? (
                <View style={styles.searchStateWrap}>
                  <ActivityIndicator size="small" color="#7C3AED" />
                </View>
              ) : null}

              {!selectedInviteUser && inviteSearchResults.length > 0 ? (
                <View style={styles.userResultsWrap}>
                  {inviteSearchResults.slice(0, 6).map(renderInviteUserRow)}
                </View>
              ) : null}

              <Text style={[styles.label, { color: text, marginTop: 14 }]}>
                Choose Your Side
              </Text>
              <View style={styles.sideChoiceWrap}>
                {form.options.map((option, index) => {
                  const label = option.trim();
                  const selected = form.creatorChoice === label;
                  return (
                    <TouchableOpacity
                      key={`creator-choice-${index}`}
                      style={[
                        styles.sideChoiceCard,
                        {
                          borderColor: selected ? '#7C3AED' : BORDER,
                          backgroundColor: selected
                            ? '#F3E8FF'
                            : inputBackground,
                          opacity: label ? 1 : 0.6,
                        },
                      ]}
                      activeOpacity={0.88}
                      disabled={!label}
                      onPress={() => updateField('creatorChoice', label)}
                    >
                      <Text
                        style={[
                          styles.sideChoiceText,
                          {
                            color: !label
                              ? '#9CA3AF'
                              : selected
                                ? '#6D28D9'
                                : text,
                          },
                        ]}
                      >
                        {label || `Add side ${index + 1} above first`}
                      </Text>
                      {selected ? (
                        <Text style={styles.sideChoiceMeta}>
                          You take this side
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!!errors.creatorChoice && (
                <Text style={styles.errorText}>{errors.creatorChoice}</Text>
              )}
              {!!form.creatorChoice && (
                <Text style={styles.helperText}>
                  Your opponent will be locked to{' '}
                  {lockedOpponentChoice || 'the opposite side'}.
                </Text>
              )}
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
              <Text
                style={[
                  styles.dateText,
                  { color: form.endTime ? text : MUTED },
                ]}
              >
                {form.endTime
                  ? formatDisplayDate(form.endTime)
                  : 'Select end time'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={MUTED} />
            </TouchableOpacity>
            {!!errors.endTime && (
              <Text style={styles.errorText}>{errors.endTime}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: text }]}>
              Stake (Optional)
            </Text>
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
            {!!errors.stake && (
              <Text style={styles.errorText}>{errors.stake}</Text>
            )}
          </View>

          <View style={styles.section}>
            <View
              style={[
                styles.publicCard,
                { backgroundColor: inputBackground, borderColor: BORDER },
              ]}
            >
              <View style={styles.publicCopy}>
                <Text style={[styles.label, { color: text, marginBottom: 4 }]}>
                  Public Battle
                </Text>
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
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.9}
          >
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
    paddingVertical: 5,
    paddingHorizontal: 5,
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
  searchInputWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
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
  sideChoiceWrap: {
    marginTop: 8,
    gap: 10,
  },
  sideChoiceCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sideChoiceText: {
    fontSize: 14,
    fontWeight: '800',
  },
  sideChoiceMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    marginTop: 4,
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
  searchStateWrap: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userResultsWrap: {
    marginTop: 10,
    gap: 8,
  },
  userResultCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedUserCard: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCopy: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
  },
  userHandle: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    marginTop: 2,
  },
  selectedUserTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#5B21B6',
  },
  selectedUserSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
    marginTop: 2,
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
    marginBottom: '15%',
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 1,
  },
});
