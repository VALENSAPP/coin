import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  PermissionsAndroid,
  Linking,
  ActivityIndicator,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import ImagePicker from 'react-native-image-crop-picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch, useSelector } from 'react-redux';
import { useLanguage } from '../../i18n';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { showToastMessage } from '../../components/displaytoastmessage';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { createMyCloset, createMyClosetItem, getMyClosetById } from '../../services/myCloset';
import ShareModal from '../../components/modals/ShareModal';
import PostLocationModal from '../../components/modals/PostLocationModal';
import { getPlaceDetails, isGooglePlacesConfigured, searchPlacePredictions, searchCityPredictions } from '../../services/googlePlaces';
import { BASE_URL } from '../../config/urls';
import { validateUsername } from '../../utils/validation';

const mixWithWhite = (hex, amount = 0.86) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return '#f4f0fb';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const mix = channel => Math.round(channel + (255 - channel) * amount);
  const toHex = channel => mix(channel).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const withAlpha = (hex, alpha = 0.12) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(124,58,237,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const formSurfaces = isDarkMode => ({
  inputSurface: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ffffff',
  labelColor: isDarkMode ? '#ffffff' : '#3f3f46',
  inputText: isDarkMode ? '#ffffff' : '#111827',
  placeholderColor: isDarkMode ? '#9ca3af' : '#a1a1aa',
  listSurface: isDarkMode ? '#1E1E1E' : '#ffffff',
  listBorder: isDarkMode ? '#333333' : '#e5e7eb',
  itemBorder: isDarkMode ? '#333333' : '#f3f4f6',
  mutedColor: isDarkMode ? '#aaaaaa' : '#6b7280',
  iconBubble: isDarkMode ? 'rgba(255,255,255,0.12)' : '#f5f3ff',
});

const selectedSurface = (accent, isDarkMode) =>
  isDarkMode ? withAlpha(accent, 0.22) : mixWithWhite(accent, 0.93);

const isBlank = value => !String(value || '').trim();

const unwrapMyClosetResponse = (source) => {
  const level1 = source?.data ?? source;
  if (level1 && typeof level1 === 'object' && !Array.isArray(level1)) {
    if (level1.data && typeof level1.data === 'object') {
      return level1.data;
    }
    return level1;
  }
  return {};
};

const InlineError = ({ message }) =>
  message ? <Text style={styles.inlineError}>{message}</Text> : null;

// ── Translated option builders ───────────────────────────────────────────
// NOTE: value stays a stable, canonical (English) string used for payloads /
// selection matching. Only the `label` shown to the user is translated.

const getCategoryOptions = t => [
  { value: 'Clothing', label: t('myClosetOptions.category.clothing') },
  { value: 'Accessories', label: t('myClosetOptions.category.accessories') },
  { value: 'Shoes', label: t('myClosetOptions.category.shoes') },
  { value: 'Bags', label: t('myClosetOptions.category.bags') },
  { value: 'Vintage', label: t('myClosetOptions.category.vintage') },
  { value: 'Beauty', label: t('myClosetOptions.category.beauty') },
  { value: 'Home Decor', label: t('myClosetOptions.category.homeDecor') },
  { value: 'Others', label: t('myClosetOptions.category.others') },
];

const getReturnPolicyOptions = t => [
  { value: 'No returns', label: t('myClosetOptions.returnPolicy.noReturns') },
  { value: '7-day returns', label: t('myClosetOptions.returnPolicy.sevenDay') },
  { value: '14-day returns', label: t('myClosetOptions.returnPolicy.fourteenDay') },
  { value: 'Exchange only', label: t('myClosetOptions.returnPolicy.exchangeOnly') },
];

const getWhoCanBuyOptions = t => [
  { value: 'Everyone', label: t('myClosetOptions.whoCanBuy.everyone') },
  { value: 'followers', label: t('myClosetOptions.whoCanBuy.followers') },
];

const getItemCategoryOptions = t => [
  { value: 'Women > Jackets', label: t('myClosetOptions.itemCategory.womenJackets') },
  { value: 'Women > Dresses', label: t('myClosetOptions.itemCategory.womenDresses') },
  { value: 'Men > Shirts', label: t('myClosetOptions.itemCategory.menShirts') },
  { value: 'Accessories > Bags', label: t('myClosetOptions.itemCategory.accessoriesBags') },
  { value: 'Shoes > Sneakers', label: t('myClosetOptions.itemCategory.shoesSneakers') },
  { value: 'Home > Decor', label: t('myClosetOptions.itemCategory.homeDecor') },
  { value: 'Vintage > Pieces', label: t('myClosetOptions.itemCategory.vintagePieces') },
  { value: 'Others', label: t('myClosetOptions.itemCategory.others') },
];

const getItemConditionOptions = t => [
  { label: t('myClosetOptions.condition.new'), value: 'New' },
  { label: t('myClosetOptions.condition.used'), value: 'Used' },
  { label: t('myClosetOptions.condition.goodCondition'), value: 'Good_condition' },
  { label: t('myClosetOptions.condition.needAttention'), value: 'Need_attention' },
];

const getItemShippingMethodOptions = t => [
  { label: t('myClosetOptions.shippingMethod.shipItems'), value: 'ship_items' },
  { label: t('myClosetOptions.shippingMethod.localPickup'), value: 'local_pick' },
];

const getShippingChoices = t => [
  {
    label: t('myClosetOptions.shippingMethod.shipItems'),
    description: t('myClosetPreferences.shipItemsDescription'),
    value: 'ship_items',
    icon: 'cube-outline',
  },
  {
    label: t('myClosetOptions.shippingMethod.localPickup'),
    description: t('myClosetPreferences.localPickupDescription'),
    value: 'local_pick',
    icon: 'location-outline',
  },
];

const getItemShippingTimeOptions = t => [
  t('myClosetOptions.shippingTime.oneToThree'),
  t('myClosetOptions.shippingTime.threeToFive'),
  t('myClosetOptions.shippingTime.fiveToSeven'),
];

// ── item-level shipping/pickup constants ────────────────────────────────
const getItemShippingFeeOptions = t => [
  t('myClosetOptions.shippingFee.free'),
  '$3.99',
  '$5.99',
  '$7.99',
  '$9.99',
  '$12.99',
];

const PICKUP_CITY_OPTIONS = [
  'Los Angeles, CA',
  'New York, NY',
  'San Francisco, CA',
  'Chicago, IL',
  'Austin, TX',
];

const PICKUP_LOCATIONS_BY_CITY = {
  'Los Angeles, CA': [
    { label: 'Westwood Village', address: '108 Westwood Blvd, Los Angeles, CA 90024' },
    { label: 'Downtown LA', address: '350 S Grand Ave, Los Angeles, CA 90071' },
  ],
  'New York, NY': [
    { label: 'Union Square', address: '4 Union Square S, New York, NY 10003' },
    { label: 'Williamsburg', address: '221 Bedford Ave, Brooklyn, NY 11249' },
  ],
  'San Francisco, CA': [
    { label: 'Hayes Valley', address: '388 Hayes St, San Francisco, CA 94102' },
  ],
  'Chicago, IL': [
    { label: 'Wicker Park', address: '1500 N Milwaukee Ave, Chicago, IL 60622' },
  ],
  'Austin, TX': [
    { label: 'South Congress', address: '1600 S Congress Ave, Austin, TX 78704' },
  ],
};

const PICKUP_TIME_OPTIONS = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM',
];

const DEFAULT_PICKUP_HOURS = {
  weekdayStart: '10:00 AM',
  weekdayEnd: '6:00 PM',
  weekendStart: '11:00 AM',
  weekendEnd: '4:00 PM',
};

const getOptionValue = option =>
  typeof option === 'string' ? option : option?.value;

const getOptionLabel = option =>
  typeof option === 'string' ? option : option?.label || option?.value || '';

const getConditionLabel = (value, t) => {
  switch (String(value || '').trim()) {
    case 'New':
      return t('myClosetOptions.condition.new');
    case 'Used':
      return t('myClosetOptions.condition.used');
    case 'Good_condition':
      return t('myClosetOptions.condition.goodCondition');
    case 'Need_attention':
      return t('myClosetOptions.condition.needAttention');
    default:
      return value || '';
  }
};

const getShippingOptionLabel = (value, t) => {
  switch (String(value || '').trim()) {
    case 'ship_items':
      return t('myClosetOptions.shippingMethod.shipItems');
    case 'local_pick':
      return t('myClosetOptions.shippingMethod.localPickup');
    default:
      return value || '';
  }
};

// ── Step definitions (translated) ───────────────────────────────────────
const getSteps = t => [
  {
    index: 1,
    title: t('myClosetSteps.createShop.title'),
    subtitle: t('myClosetSteps.createShop.subtitle'),
  },
  {
    index: 2,
    title: t('myClosetSteps.uploadLogo.title'),
    subtitle: t('myClosetSteps.uploadLogo.subtitle'),
  },
  {
    index: 3,
    title: t('myClosetSteps.tellUs.title'),
    subtitle: t('myClosetSteps.tellUs.subtitle'),
  },
  {
    index: 4,
    title: t('myClosetSteps.preferences.title'),
    subtitle: t('myClosetSteps.preferences.subtitle'),
  },
];

const getItemSteps = t => [
  {
    index: 1,
    title: t('myClosetItemSteps.photos.title'),
    subtitle: t('myClosetItemSteps.photos.subtitle'),
  },
  {
    index: 2,
    title: t('myClosetItemSteps.details.title'),
    subtitle: t('myClosetItemSteps.details.subtitle'),
  },
  {
    index: 3,
    title: t('myClosetItemSteps.price.title'),
    subtitle: t('myClosetItemSteps.price.subtitle'),
  },
  {
    index: 4,
    title: t('myClosetItemSteps.shipping.title'),
    subtitle: t('myClosetItemSteps.shipping.subtitle'),
  },
  {
    index: 5,
    title: t('myClosetItemSteps.review.title'),
    subtitle: t('myClosetItemSteps.review.subtitle'),
  },
];

const FlowShell = ({
  navigation,
  activeStep,
  steps,
  title,
  subtitle,
  children,
}) => {
  const { bgStyle, textStyle, mutedTextStyle, accent, icon, cardStyle, border } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const chipSurface = isDarkMode ? 'rgba(255,255,255,0.08)' : '#ffffff';
  const currentStep = steps.find(step => step.index === activeStep) || steps[0];
  const themeProps = {
    accent,
    text: accent,
    textStyle,
    mutedTextStyle,
    cardStyle,
    border,
    icon,
  };

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={120}
        extraHeight={120}
        keyboardOpeningTime={0}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: chipSurface }]}
          >
            <Ionicons name="chevron-back" size={24} color={accent} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, textStyle]}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.stepRow}>
          {steps.map((step, index) => {
            const active = activeStep === step.index;
            const completed = activeStep > step.index;
            return (
              <React.Fragment key={step.index}>
                <View
                  style={[
                    styles.stepCircle,
                    cardStyle,
                    { borderColor: withAlpha(accent, 0.45) },
                    (active || completed) && { backgroundColor: accent, borderColor: accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.stepCircleText,
                      !(active || completed) && mutedTextStyle,
                      (active || completed) && styles.stepCircleTextActive,
                    ]}
                  >
                    {step.index}
                  </Text>
                </View>
                {index < steps.length - 1 ? (
                  <View
                    style={[
                      styles.stepConnectorLine,
                      { backgroundColor: withAlpha(accent, completed || active ? 1 : 0.35) },
                    ]}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>

        <View style={styles.heroBlock}>
          <Text style={[styles.heroTitle, textStyle]}>{currentStep.title}</Text>
          <Text style={[styles.heroSubtitle, mutedTextStyle]}>
            {subtitle || currentStep.subtitle}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            cardStyle,
            { borderColor: border },
          ]}
        >
          {children(themeProps)}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};
const Shell = ({ navigation, activeStep, children }) => {
  const { bgStyle, textStyle, mutedTextStyle, accent, icon, cardStyle, border } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const chipSurface = isDarkMode ? 'rgba(255,255,255,0.08)' : '#ffffff';
  const { t } = useLanguage();
  const STEPS = useMemo(() => getSteps(t), [t]);
  const currentStep = STEPS.find(step => step.index === activeStep) || STEPS[0];
  const themeProps = {
    accent,
    text: accent,
    textStyle,
    mutedTextStyle,
    cardStyle,
    border,
    icon,
  };

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={60}
        extraHeight={120}
        keyboardOpeningTime={0}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: chipSurface }]}
          >
            <Ionicons name="chevron-back" size={24} color={accent} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, textStyle]}>{t('myClosetShared.headerTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.stepRow}>
          {STEPS.map((step, index) => {
            const active = activeStep === step.index;
            const completed = activeStep > step.index;
            return (
              <React.Fragment key={step.index}>
                <View
                  style={[
                    styles.stepCircle,
                    cardStyle,
                    { borderColor: withAlpha(accent, 0.45) },
                    (active || completed) && { backgroundColor: accent, borderColor: accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.stepCircleText,
                      !(active || completed) && mutedTextStyle,
                      (active || completed) && styles.stepCircleTextActive,
                    ]}
                  >
                    {step.index}
                  </Text>
                </View>
                {index < STEPS.length - 1 ? (
                  <View
                    style={[
                      styles.stepConnectorLine,
                      { backgroundColor: withAlpha(accent, completed || active ? 1 : 0.35) },
                    ]}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>

        <View style={styles.heroBlock}>
          <Text style={[styles.heroTitle, textStyle]}>{currentStep.title}</Text>
          <Text style={[styles.heroSubtitle, mutedTextStyle]}>
            {currentStep.subtitle}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            cardStyle,
            { borderColor: border },
          ]}
        >
          {children(themeProps)}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const PrimaryButton = ({ label, onPress, text, accent, disabled = false }) => {
  const color = accent || text;
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[
        styles.primaryButton,
        { backgroundColor: color },
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const SecondaryButton = ({ label, onPress, text, accent, cardStyle: cardStyleProp }) => {
  const { cardStyle: themeCardStyle } = useAppTheme();
  const color = accent || text;
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.secondaryButton,
        cardStyleProp || themeCardStyle,
        { borderColor: withAlpha(color, 0.35) },
      ]}
    >
      <Text style={[styles.secondaryButtonText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
};

const Field = ({
  label,
  placeholder,
  value,
  onChangeText,
  multiline = false,
  prefix,
  text,
  height,
  error,
  keyboardType,
}) => {
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);

  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: surfaces.labelColor }]}>{label}</Text>
      <View
        style={[
          styles.fieldWrap,
          {
            backgroundColor: surfaces.inputSurface,
            borderColor: error ? '#dc2626' : withAlpha(text, isDarkMode ? 0.35 : 0.16),
          },
        ]}
      >
        {prefix ? (
          <Text style={[styles.fieldPrefix, { color: surfaces.mutedColor }]}>{prefix}</Text>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={surfaces.placeholderColor}
          multiline={multiline}
          keyboardType={keyboardType}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[
            styles.fieldInput,
            { color: surfaces.inputText },
            multiline && { minHeight: height || 92 },
          ]}
        />
      </View>
      <InlineError message={error} />
    </View>
  );
};

const PlaceFieldRow = ({
  icon,
  label,
  placeholder,
  value,            // committed value only — shown when collapsed
  filled,
  loading,
  expanded,
  disabled,
  onToggle,
  onCollapse,
  text,
  error,
  query,            // live search text — only used while expanded
  onQueryChange,
  predictions,
  searching,
  onSelectPrediction,
  t,
}) => {
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const borderColor = error ? '#dc2626' : withAlpha(text, isDarkMode ? 0.35 : 0.16);

  return (
    <View style={styles.placeFieldBlock}>
      <View style={styles.placeFieldTopRow}>
        <View style={[styles.placeFieldIconWrap, { backgroundColor: surfaces.iconBubble }]}>
          <Ionicons name={icon} size={17} color={text} />
        </View>
        <Text style={[styles.placeFieldLabel, { color: surfaces.labelColor }]} numberOfLines={1}>
          {label}
        </Text>

        {expanded ? (
          <View
            style={[
              styles.placeFieldValueBox,
              styles.placeFieldValueBoxActive,
              { borderColor, backgroundColor: surfaces.inputSurface },
            ]}
          >
            <TextInput
              value={query}
              onChangeText={onQueryChange}
              placeholder={t('myClosetShared.searchPlaceholder', { label: label.toLowerCase() })}
              placeholderTextColor={surfaces.placeholderColor}
              autoFocus
              style={[styles.placeFieldSearchInline, { color: surfaces.inputText }]}
            />
            <TouchableOpacity onPress={onCollapse} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-up" size={16} color={surfaces.mutedColor} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={disabled ? undefined : onToggle}
            style={[
              styles.placeFieldValueBox,
              disabled && styles.placeFieldValueBoxDisabled,
              { borderColor, backgroundColor: surfaces.inputSurface },
            ]}
          >
            <Text
              style={[
                styles.placeFieldValueText,
                { color: value ? surfaces.inputText : surfaces.placeholderColor },
              ]}
              numberOfLines={1}
            >
              {value || placeholder}
            </Text>
            <Ionicons name="chevron-down" size={16} color={surfaces.mutedColor} />
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator size="small" color={text} style={styles.placeFieldCheck} />
        ) : filled && !expanded ? (
          <View style={styles.placeFieldCheck}>
            <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
          </View>
        ) : (
          <View style={styles.placeFieldCheck} />
        )}
      </View>

      {expanded ? (
        <View
          style={[
            styles.placeFieldPredictionsBox,
            {
              backgroundColor: surfaces.listSurface,
              borderColor: surfaces.listBorder,
            },
          ]}
        >
          {searching ? (
            <View style={styles.placeFieldSearchingRow}>
              <ActivityIndicator size="small" color={text} />
            </View>
          ) : null}
          {predictions.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              onPress={() => onSelectPrediction(item)}
              style={[
                styles.dropdownItem,
                { backgroundColor: surfaces.listSurface },
                index !== predictions.length - 1 && [
                  styles.dropdownItemBorder,
                  { borderBottomColor: surfaces.itemBorder },
                ],
              ]}
            >
              <Text
                style={[styles.dropdownItemText, { color: surfaces.inputText }]}
                numberOfLines={2}
              >
                {item.description}
              </Text>
            </TouchableOpacity>
          ))}
          {!searching && query.trim().length >= 2 && predictions.length === 0 ? (
            <Text style={[styles.placeFieldNoResults, { color: surfaces.mutedColor }]}>
              {t('myClosetShared.noMatchesFound')}
            </Text>
          ) : null}
        </View>
      ) : null}

      <InlineError message={error} />
    </View>
  );
};

const DropdownRow = ({
  label,
  placeholder,
  value,
  expanded,
  onToggle,
  onSelect,
  options,
  text,
  error,
}) => {
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const selectedOption = options.find(item => getOptionValue(item) === value);
  const displayValue = selectedOption ? getOptionLabel(selectedOption) : value;

  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: surfaces.labelColor }]}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onToggle}
        style={[
          styles.dropdownRow,
          expanded && styles.dropdownRowActive,
          {
            backgroundColor: surfaces.inputSurface,
            borderColor: error ? '#dc2626' : withAlpha(text, isDarkMode ? 0.35 : 0.16),
          },
        ]}
      >
        <Text
          style={[
            styles.dropdownText,
            { color: displayValue ? surfaces.inputText : surfaces.placeholderColor },
          ]}
        >
          {displayValue || placeholder}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={text}
        />
      </TouchableOpacity>
      {expanded ? (
        <ScrollView
          style={[
            styles.dropdownList,
            {
              backgroundColor: surfaces.listSurface,
              borderColor: surfaces.listBorder,
            },
          ]}
          contentContainerStyle={styles.dropdownListContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          persistentScrollbar
          keyboardShouldPersistTaps="handled"
        >
          {options.map((item, index) => {
            const itemValue = getOptionValue(item);
            const itemLabel = getOptionLabel(item);
            const selected = value === itemValue;
            return (
              <TouchableOpacity
                key={itemValue || itemLabel || index}
                activeOpacity={0.8}
                onPress={() => onSelect(itemValue)}
                style={[
                  styles.dropdownItem,
                  {
                    backgroundColor: selected
                      ? selectedSurface(text, isDarkMode)
                      : surfaces.listSurface,
                  },
                  index !== options.length - 1 && [
                    styles.dropdownItemBorder,
                    { borderBottomColor: surfaces.itemBorder },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    { color: selected ? text : surfaces.inputText },
                  ]}
                >
                  {itemLabel}
                </Text>
                {selected ? (
                  <Ionicons name="checkmark" size={16} color={text} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
      <InlineError message={error} />
    </View>
  );
};

const OptionCard = ({ label, description, selected, onPress, text, icon }) => {
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.optionCard,
        {
          borderColor: selected ? text : withAlpha(text, isDarkMode ? 0.28 : 0.14),
          backgroundColor: selected
            ? selectedSurface(text, isDarkMode)
            : surfaces.inputSurface,
        },
      ]}
    >
      <View style={[styles.optionIconWrap, { backgroundColor: surfaces.iconBubble }]}>
        <Ionicons name={icon} size={18} color={text} />
      </View>
      <View style={styles.optionCopy}>
        <Text style={[styles.optionLabel, { color: surfaces.inputText }]}>{label}</Text>
        <Text style={[styles.optionDescription, { color: surfaces.mutedColor }]}>
          {description}
        </Text>
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={text}
      />
    </TouchableOpacity>
  );
};

// ── multi-select delivery method card with checkbox + inline bullet list
const DeliveryOptionCard = ({
  label,
  description,
  bullets,
  selected,
  onPress,
  text,
  icon,
}) => {
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.deliveryCard,
        {
          borderColor: selected ? text : withAlpha(text, isDarkMode ? 0.28 : 0.14),
          backgroundColor: selected
            ? selectedSurface(text, isDarkMode)
            : surfaces.inputSurface,
        },
      ]}
    >
      <View style={styles.deliveryCardTopRow}>
        <View style={[styles.optionIconWrap, { backgroundColor: surfaces.iconBubble }]}>
          <Ionicons name={icon} size={18} color={text} />
        </View>
        <View
          style={[
            styles.checkboxBadge,
            selected
              ? { backgroundColor: text }
              : {
                backgroundColor: surfaces.inputSurface,
                borderWidth: 1,
                borderColor: withAlpha(text, 0.3),
              },
          ]}
        >
          {selected ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
        </View>
      </View>
      <Text style={[styles.deliveryLabel, { color: surfaces.inputText }]}>{label}</Text>
      <Text style={[styles.deliveryDescription, { color: surfaces.mutedColor }]}>
        {description}
      </Text>
      {bullets?.length ? (
        <View style={styles.deliveryBulletList}>
          {bullets.map(bullet => {
            const bulletText = typeof bullet === 'string' ? bullet : bullet?.label || '';
            return (
              <View key={bulletText} style={styles.deliveryBulletRow}>
                <Ionicons name="ellipse" size={4} color={surfaces.mutedColor} />
                <Text style={[styles.deliveryBulletText, { color: surfaces.mutedColor }]}>
                  {bulletText}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

// ── pill-style toggle switch, mirrors the buyer chat toggle
const ToggleSwitch = ({ value, onValueChange, accent }) => {
  const { isDarkMode } = useThemeContext();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onValueChange(!value)}
      style={[
        styles.toggleTrack,
        { backgroundColor: value ? accent : isDarkMode ? '#333333' : '#e5e7eb' },
      ]}
    >
      <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
    </TouchableOpacity>
  );
};

// ── labelled section header used inside the shipping & return step
const SectionHeader = ({ icon, title, badge, text }) => {
  const { textStyle } = useAppTheme();
  return (
    <View style={styles.sectionHeaderRow}>
      {icon ? <Ionicons name={icon} size={16} color={text} /> : null}
      <Text style={[styles.sectionHeaderTitle, textStyle, icon && { marginLeft: 6 }]}>
        {title}
      </Text>
      {badge ? (
        <View style={[styles.sectionHeaderBadge, { backgroundColor: withAlpha(text, 0.1) }]}>
          <Text style={[styles.sectionHeaderBadgeText, { color: text }]}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
};

const requestCameraPermission = async t => {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: t('myClosetShared.cameraPermissionTitle'),
        message: t('myClosetShared.cameraPermissionRationale'),
        buttonNeutral: t('myClosetShared.askMeLater'),
        buttonNegative: t('myClosetShared.cancel'),
        buttonPositive: t('myClosetShared.ok'),
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn('Camera permission error:', error);
    return false;
  }
};

const makePickedLogo = asset => {
  if (!asset?.uri) return null;
  return {
    uri: asset.uri,
    name: asset.fileName || `logo-${Date.now()}.jpg`,
    type: asset.type || 'image/jpeg',
  };
};

const MyClosetCreateShopScreen = ({ navigation, route }) => {
  const draft = route?.params?.draft || {};
  const [shopName, setShopName] = useState(draft.shopName || '');
  const [username, setUsername] = useState(draft.username || '');
  const [errors, setErrors] = useState({});
  const { accent, textStyle, mutedTextStyle, cardStyle, border, icon, bgStyle, mutedText } = useAppTheme();
  const text = accent;
  const { t } = useLanguage();
  const nextDraft = useMemo(
    () => ({ ...draft, shopName, username }),
    [draft, shopName, username],
  );

  const handleContinue = () => {
    const nextErrors = {};
    if (isBlank(shopName)) nextErrors.shopName = t('myClosetCreateShop.errors.shopNameRequired');
    const usernameError = validateUsername(username, t);
    if (usernameError) nextErrors.username = usernameError;

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    navigation.navigate('MyClosetUploadLogo', { draft: nextDraft });
  };

  return (
    <Shell navigation={navigation} activeStep={1}>
      {() => (
        <>
          <Field
            label={t('myClosetCreateShop.shopNameLabel')}
            placeholder={t('myClosetCreateShop.shopNamePlaceholder')}
            value={shopName}
            onChangeText={value => {
              setShopName(value);
              if (errors.shopName) {
                setErrors(prev => ({ ...prev, shopName: null }));
              }
            }}
            text={text}
            error={errors.shopName}
          />
          <Field
            label={t('myClosetCreateShop.usernameLabel')}
            placeholder={t('myClosetCreateShop.usernamePlaceholder')}
            value={username}
            onChangeText={value => {
              setUsername(value);
              const usernameError = validateUsername(value, t);
              setErrors(prev => ({
                ...prev,
                username: usernameError || null,
              }));
            }}
            prefix="valens.app/"
            text={text}
            error={errors.username}
          />

          <View style={styles.featureList}>
            <View style={styles.featureRow}>
              <Ionicons name="bulb-outline" size={18} color={text} />
              <Text style={[styles.featureText, mutedTextStyle]}>
                {t('myClosetCreateShop.featureEasyToFind')}
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="pricetag-outline" size={18} color={text} />
              <Text style={[styles.featureText, mutedTextStyle]}>
                {t('myClosetCreateShop.featureBuildBrand')}
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="people-outline" size={18} color={text} />
              <Text style={[styles.featureText, mutedTextStyle]}>
                {t('myClosetCreateShop.featureGrowCommunity')}
              </Text>
            </View>
          </View>

          <PrimaryButton
            label={t('myClosetShared.continue')}
            text={text}
            onPress={handleContinue}
          />
        </>
      )}
    </Shell>
  );
};

const MyClosetUploadLogoScreen = ({ navigation, route }) => {
  const draft = route?.params?.draft || {};
  const [logoChosen, setLogoChosen] = useState(Boolean(draft.logo));
  const [logo, setLogo] = useState(draft.logo || null);
  const [error, setError] = useState('');
  const { accent, textStyle, mutedTextStyle, cardStyle, border, icon, bgStyle, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const text = accent;
  const { t } = useLanguage();

  const nextDraft = useMemo(
    () => ({ ...draft, logoChosen, logo }),
    [draft, logoChosen, logo],
  );

  const handleSelectedLogo = asset => {
    const picked = makePickedLogo(asset);
    if (!picked) return;
    setLogo(picked);
    setLogoChosen(true);
    setError('');
  };

  const pickFromLibrary = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: false,
        quality: 0.9,
      });
      if (response?.didCancel || response?.errorCode) return;
      handleSelectedLogo(response?.assets?.[0]);
    } catch (err) {
      console.warn('Logo library picker error:', err);
      setError(t('myClosetUploadLogo.unableToOpenLibrary'));
    }
  };

  const pickFromCamera = async () => {
    const hasPermission = await requestCameraPermission(t);
    if (!hasPermission) {
      Alert.alert(
        t('myClosetShared.cameraPermissionTitle'),
        t('myClosetUploadLogo.cameraPermissionMessage'),
      );
      return;
    }

    try {
      const response = await launchCamera({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: false,
        quality: 0.9,
      });
      if (response?.didCancel || response?.errorCode) return;
      handleSelectedLogo(response?.assets?.[0]);
    } catch (err) {
      console.warn('Logo camera picker error:', err);
      setError(t('myClosetUploadLogo.unableToOpenCamera'));
    }
  };

  const handleContinue = () => {
    if (!logoChosen || !logo?.uri) {
      setError(t('myClosetUploadLogo.uploadRequired'));
      return;
    }

    setError('');
    navigation.navigate('MyClosetTellUs', { draft: nextDraft });
  };

  return (
    <Shell navigation={navigation} activeStep={2}>
      {() => (
        <>
          <View style={styles.logoHeroWrap}>
            <TouchableOpacity
              onPress={pickFromCamera}
              style={[
                styles.logoHero,
                {
                  borderColor: withAlpha(text, isDarkMode ? 0.45 : 0.35),
                  backgroundColor: isDarkMode
                    ? surfaces.inputSurface
                    : mixWithWhite(text, 0.94),
                },
              ]}
            >
              {logo?.uri ? (
                <Image
                  source={{ uri: logo.uri }}
                  style={styles.logoPreviewImage}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Ionicons name="add" size={42} color={text} />
                  <Text style={[styles.logoHeroLabel, { color: text }]}>{t('myClosetUploadLogo.uploadLogo')}</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={[styles.orText, { color: surfaces.mutedColor }]}>
              {t('myClosetShared.or')}
            </Text>
          </View>
          <SecondaryButton
            label={t('myClosetUploadLogo.chooseFromLibrary')}
            text={text}
            onPress={pickFromLibrary}
          />
          <InlineError message={error} />
          <Text style={[styles.helperText, { color: surfaces.mutedColor }]}>
            {t('myClosetUploadLogo.recommendationHint')}
          </Text>

          <PrimaryButton
            label={t('myClosetShared.continue')}
            text={text}
            onPress={handleContinue}
          />
        </>
      )}
    </Shell>
  );
};

const MyClosetTellUsScreen = ({ navigation, route }) => {
  const draft = route?.params?.draft || {};
  const [description, setDescription] = useState(draft.description || '');
  const [category, setCategory] = useState(draft.category || '');
  const [location, setLocation] = useState(draft.location || '');
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [expandedField, setExpandedField] = useState(null);
  const [errors, setErrors] = useState({});
  const { accent, textStyle, mutedTextStyle, cardStyle, border, icon, bgStyle, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const text = accent;
  const { t } = useLanguage();
  const categoryOptions = useMemo(() => getCategoryOptions(t), [t]);

  const nextDraft = useMemo(
    () => ({ ...draft, description, category, location }),
    [draft, description, category, location],
  );

  const handleContinue = () => {
    const nextErrors = {};
    if (isBlank(description)) {
      nextErrors.description = t('myClosetTellUs.errors.descriptionRequired');
    }
    if (isBlank(category)) {
      nextErrors.category = t('myClosetTellUs.errors.categoryRequired');
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    navigation.navigate('MyClosetPreferences', { draft: nextDraft });
  };

  return (
    <Shell navigation={navigation} activeStep={3}>
      {() => (
        <>
          <Field
            label={t('myClosetTellUs.descriptionLabel')}
            placeholder={t('myClosetTellUs.descriptionPlaceholder')}
            value={description}
            onChangeText={value => {
              setDescription(value);
              if (errors.description) {
                setErrors(prev => ({ ...prev, description: null }));
              }
            }}
            multiline
            height={120}
            text={text}
            error={errors.description}
          />
          <DropdownRow
            label={t('myClosetTellUs.categoryLabel')}
            placeholder={t('myClosetTellUs.categoryPlaceholder')}
            value={category}
            expanded={expandedField === 'category'}
            onToggle={() =>
              setExpandedField(prev =>
                prev === 'category' ? null : 'category',
              )
            }
            onSelect={item => {
              setCategory(item);
              setExpandedField(null);
              if (errors.category) {
                setErrors(prev => ({ ...prev, category: null }));
              }
            }}
            options={categoryOptions}
            text={text}
            error={errors.category}
          />
          <View style={styles.fieldBlock}>
            <Text style={[styles.fieldLabel, { color: surfaces.labelColor }]}>
              {t('myClosetTellUs.locationLabel')}
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setLocationModalVisible(true)}
              style={[
                styles.dropdownRow,
                {
                  backgroundColor: surfaces.inputSurface,
                  borderColor: withAlpha(text, isDarkMode ? 0.35 : 0.16),
                },
              ]}
            >
              <Ionicons
                name="location-sharp"
                size={18}
                color="#E53935"
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.dropdownText,
                  {
                    color: location.trim()
                      ? surfaces.inputText
                      : surfaces.placeholderColor,
                  },
                ]}
                numberOfLines={1}
              >
                {location.trim() || t('myClosetTellUs.locationPlaceholder')}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={text} />
            </TouchableOpacity>
          </View>

          <PostLocationModal
            visible={locationModalVisible}
            initialValue={location}
            saving={false}
            onClose={() => setLocationModalVisible(false)}
            onSave={value => {
              setLocation(String(value || '').trim());
              setLocationModalVisible(false);
            }}
          />

          <PrimaryButton
            label={t('myClosetShared.continue')}
            text={text}
            onPress={handleContinue}
          />
        </>
      )}
    </Shell>
  );
};

const MyClosetPreferencesScreen = ({ navigation, route }) => {
  const draft = route?.params?.draft || {};
  const [shipping, setShipping] = useState(['ship_items']);
  const [returnPolicy, setReturnPolicy] = useState('');
  const [paymentMethod] = useState('Valens Secure Checkout');
  const [whoCanBuy, setWhoCanBuy] = useState('');
  const [expandedField, setExpandedField] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dispatch = useDispatch();
  const toast = useToast();
  const { accent, textStyle, mutedTextStyle, cardStyle, border, icon, bgStyle, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const text = accent;
  const { t } = useLanguage();
  const userProfile = useSelector(state => state.userProfile.userProfile);
  const shippingChoices = useMemo(() => getShippingChoices(t), [t]);
  const returnPolicyOptions = useMemo(() => getReturnPolicyOptions(t), [t]);
  const whoCanBuyOptions = useMemo(() => getWhoCanBuyOptions(t), [t]);
  const nextDraft = useMemo(
    () => ({ ...draft, shipping, returnPolicy, paymentMethod, whoCanBuy }),
    [draft, shipping, returnPolicy, paymentMethod, whoCanBuy],
  );

  const handleContinue = async () => {
    const nextErrors = {};

    if (shipping.length == 0) {
      nextErrors.shipping = t('myClosetPreferences.errors.shippingRequired');
    }

    if (isBlank(returnPolicy)) {
      nextErrors.returnPolicy = t('myClosetPreferences.errors.returnPolicyRequired');
    }
    if (isBlank(whoCanBuy)) {
      nextErrors.whoCanBuy = t('myClosetPreferences.errors.whoCanBuyRequired');
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    const payload = new FormData();
    payload.append('shopName', String(nextDraft.shopName || '').trim());
    payload.append('shopUsername', String(nextDraft.username || '').trim());
    payload.append('description', String(nextDraft.description || '').trim());
    payload.append('shopCategory', String(nextDraft.category || '').trim());
    payload.append('location', String(nextDraft.location || '').trim());
    payload.append('whoCanBuy', String(nextDraft.whoCanBuy || '').trim());
    payload.append('paymentMethod', String(nextDraft.paymentMethod || '').trim());
    const selectedShipping = nextDraft.shipping || [];

    let shippingOptions = 'ship_items';

    if (
      selectedShipping.includes('ship_items') &&
      selectedShipping.includes('local_pick')
    ) {
      shippingOptions = 'both';
    } else if (selectedShipping.includes('local_pick')) {
      shippingOptions = 'local_pick';
    } else if (selectedShipping.includes('ship_items')) {
      shippingOptions = 'ship_items';
    }

    payload.append('shippingOptions', shippingOptions);
    payload.append('returnPolicy', String(nextDraft.returnPolicy || '').trim());

    if (nextDraft?.logo?.uri) {
      payload.append('shopLogo', {
        uri: nextDraft.logo.uri,
        name: nextDraft.logo.name || `shop-logo-${Date.now()}.jpg`,
        type: nextDraft.logo.type || 'image/jpeg',
      });
    }

    setIsSubmitting(true);
    dispatch(showLoader());
    try {
      const response = await createMyCloset(payload);
      const code = response?.statusCode;
      if (code === 200 || code === 201) {
        showToastMessage(
          toast,
          'success',
          response?.message || t('myClosetPreferences.createSuccess'),
        );
        navigation.navigate('MyClosetLive', { draft: nextDraft });
        return;
      }

      showToastMessage(
        toast,
        'danger',
        response?.message || t('myClosetPreferences.createFailure'),
      );
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || t('myClosetPreferences.createFailure'),
      );
    } finally {
      setIsSubmitting(false);
      dispatch(hideLoader());
    }
  };

  return (
    <Shell navigation={navigation} activeStep={4}>
      {() => (
        <>
          <Text style={[styles.sectionLabel, { color: surfaces.labelColor }]}>
            {t('myClosetPreferences.shippingOptionsLabel')}
          </Text>
          <View style={styles.shippingGrid}>
            {shippingChoices.map(choice => {
              const isSelected = shipping.includes(choice.value);
              return (
                <OptionCard
                  key={choice.value}
                  label={choice.label}
                  description={choice.description}
                  selected={isSelected}
                  onPress={() => {
                    setShipping(prev =>
                      prev.includes(choice.value)
                        ? prev.filter(v => v !== choice.value) // unselect
                        : [...prev, choice.value],              // add to selection
                    );
                  }}
                  text={text}
                  icon={choice.icon}
                />
              );
            })}
          </View>
          <View style={{ marginTop: -10, marginBottom: 5 }}>
            <InlineError message={errors.shipping} />
          </View>

          <DropdownRow
            label={t('myClosetPreferences.returnPolicyLabel')}
            placeholder={t('myClosetPreferences.returnPolicyPlaceholder')}
            value={returnPolicy}
            expanded={expandedField === 'returnPolicy'}
            onToggle={() =>
              setExpandedField(prev =>
                prev === 'returnPolicy' ? null : 'returnPolicy',
              )
            }
            onSelect={item => {
              setReturnPolicy(item);
              setExpandedField(null);
              if (errors.returnPolicy) {
                setErrors(prev => ({ ...prev, returnPolicy: null }));
              }
            }}
            options={returnPolicyOptions}
            text={text}
            error={errors.returnPolicy}
          />

          <View
            style={[
              styles.paymentCard,
              {
                borderColor: withAlpha(text, isDarkMode ? 0.35 : 0.16),
                backgroundColor: isDarkMode
                  ? selectedSurface(text, isDarkMode)
                  : mixWithWhite(text, 0.95),
              },
            ]}
          >
            <View
              style={[styles.paymentIcon, { backgroundColor: surfaces.inputSurface }]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={text}
              />
            </View>
            <View style={styles.paymentCopy}>
              <Text style={[styles.paymentTitle, { color: surfaces.inputText }]}>
                {t('myClosetPreferences.paymentTitle')}
              </Text>
              <Text style={[styles.paymentSubtitle, { color: surfaces.mutedColor }]}>
                {t('myClosetPreferences.paymentSubtitle')}
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={text} />
          </View>

          <DropdownRow
            label={t('myClosetPreferences.whoCanBuyLabel')}
            placeholder={t('myClosetPreferences.whoCanBuyPlaceholder')}
            value={whoCanBuy}
            expanded={expandedField === 'whoCanBuy'}
            onToggle={() =>
              setExpandedField(prev =>
                prev === 'whoCanBuy' ? null : 'whoCanBuy',
              )
            }
            onSelect={item => {
              setWhoCanBuy(item);
              setExpandedField(null);
            }}
            options={whoCanBuyOptions}
            text={text}
            error={errors.whoCanBuy}
          />

          <PrimaryButton
            label={t('myClosetPreferences.launchButton')}
            text={text}
            onPress={handleContinue}
            disabled={isSubmitting}
          />
        </>
      )}
    </Shell>
  );
};

const MyClosetLiveScreen = ({ navigation, route }) => {
  const userProfile = useSelector(state => state.userProfile.userProfile);
  const draft = route?.params?.draft || {};
  const isFirstItem = route?.params?.isFirstItem ?? true;
  const { accent, textStyle, mutedTextStyle, cardStyle, border, icon, bgStyle, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const text = accent;
  const { t } = useLanguage();
  const toast = useToast();
  const itemTitle = isFirstItem ? t('myClosetLive.addFirstItem') : t('myClosetLive.addNewItem');
  const shopLink = useMemo(
    () =>
      `valens.app/${String(draft.username || 'yourcloset')
        .replace(/[^a-z0-9._-]/gi, '')
        .toLowerCase()}`,
    [draft.username],
  );

  useEffect(() => {
    const persistShopState = async () => {
      try {
        await AsyncStorage.multiSet([
          ['myClosetCreated', 'true'],
          ['myClosetDraft', JSON.stringify(draft || {})],
        ]);
      } catch (error) {
        console.warn('Unable to persist My Closet state:', error);
      }
    };

    persistShopState();
  }, [draft]);

  const copyShopLink = () => {
    Clipboard.setString(shopLink);
    showToastMessage(toast, 'success', t('myClosetLive.linkCopied'));
  };

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <ScrollView
        contentContainerStyle={styles.successContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.confettiLayer} pointerEvents="none">
          <View style={[styles.confettiDot, styles.confettiDotOne]} />
          <View style={[styles.confettiDot, styles.confettiDotTwo]} />
          <View style={[styles.confettiDot, styles.confettiDotThree]} />
          <View style={[styles.confettiDot, styles.confettiDotFour]} />
          <View style={[styles.confettiDot, styles.confettiDotFive]} />
        </View>

        <View style={styles.successAvatarWrap}>
          <View
            style={[
              styles.successAvatar,
              {
                borderColor: withAlpha(text, 0.18),
                backgroundColor: surfaces.inputSurface,
              },
            ]}
          >
            <Ionicons name="bag-handle-outline" size={28} color={text} />
          </View>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
        </View>

        <Text style={[styles.successTitle, { color: text }]}>
          {userProfile == 'user' ? t('myClosetLive.closetLiveTitle') : t('myClosetLive.shopLiveTitle')}
        </Text>
        <Text style={[styles.successSubtitle, mutedTextStyle]}>
          {t('myClosetLive.subtitle')}
        </Text>

        <View
          style={[
            styles.linkCard,
            cardStyle,
            { borderColor: withAlpha(text, isDarkMode ? 0.35 : 0.16) },
          ]}
        >
          <View style={styles.linkCopy}>
            <Text style={[styles.linkLabel, { color: surfaces.mutedColor }]}>
              {t('myClosetLive.shopLinkLabel')}
            </Text>
            <Text style={[styles.linkValue, { color: surfaces.inputText }]}>
              {shopLink}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={copyShopLink}
            style={[styles.copyButton, { backgroundColor: surfaces.iconBubble }]}
          >
            <Ionicons name="copy-outline" size={18} color={text} />
          </TouchableOpacity>
        </View>

        <View style={styles.successActions}>
          <SecondaryButton
            label={userProfile == 'user' ? t('myClosetLive.goToCloset') : t('myClosetLive.goToShop')}
            text={text}
            onPress={() => {
              navigation.navigate('ProfileMain', {
                screen: 'Profile',
                params: { initialTab: 'closet' },
              });
            }}
          />
          <PrimaryButton
            label={itemTitle}
            text={text}
            onPress={() => {
              navigation.navigate('MyClosetAddItemPhotos', { draft: {}, isFirstItem: isFirstItem });
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const makePickedItemPhoto = asset => {
  const uri = asset?.uri || asset?.path;
  if (!uri) return null;
  return {
    uri,
    name: asset.fileName || asset?.filename || `item-${Date.now()}.jpg`,
    type: asset.type || asset?.mime || 'image/jpeg',
    width: asset.width,
    height: asset.height,
  };
};

const PhotoTile = ({ photo, onRemove }) => (
  <View style={styles.photoTile}>
    <Image source={{ uri: photo.uri }} style={styles.photoTileImage} />
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onRemove}
      style={styles.photoRemove}
    >
      <Ionicons name="close" size={14} color="#fff" />
    </TouchableOpacity>
  </View>
);

const QuantityStepper = ({ value, onMinus, onPlus, text, bgStyle }) => {
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);

  return (
    <View
      style={[
        styles.quantityStepper,
        {
          backgroundColor: surfaces.inputSurface,
          borderColor: withAlpha(text, isDarkMode ? 0.35 : 0.16),
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onMinus}
        style={[styles.quantityBtn, bgStyle]}
      >
        <Text style={[styles.quantityBtnText, { color: text }]}>-</Text>
      </TouchableOpacity>
      <Text style={[styles.quantityValue, { color: surfaces.inputText }]}>{value}</Text>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPlus}
        style={[styles.quantityBtn, bgStyle]}
      >
        <Text style={[styles.quantityBtnText, { color: text }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const MyClosetAddItemPhotosScreen = ({ navigation, route }) => {
  const draft = route?.params?.draft || {};
  const isFirstItem = route?.params?.isFirstItem ?? true;  // add
  const [photos, setPhotos] = useState(draft.photos || []);
  const [error, setError] = useState('');
  const { accent, textStyle, mutedTextStyle, cardStyle, border, icon, bgStyle, mutedText, card } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const text = accent;
  const surfaces = formSurfaces(isDarkMode);
  const tipColor = mutedText || (isDarkMode ? '#aaaaaa' : '#374151');
  const { t } = useLanguage();
  const itemTitle = isFirstItem ? t('myClosetLive.addFirstItem') : t('myClosetLive.addNewItem');
  const ITEM_STEPS = useMemo(() => getItemSteps(t), [t]);

  const handleSelectedPhotos = assets => {
    const nextPhotos = (assets || []).map(makePickedItemPhoto).filter(Boolean);
    if (!nextPhotos.length) return;
    setPhotos(prev => [...prev, ...nextPhotos].slice(0, 10));
    setError('');
  };

  const pickFromGallery = async () => {
    try {
      const response = await ImagePicker.openPicker({
        mediaType: 'photo',
        multiple: true,
        maxFiles: Math.max(1, 10 - photos.length),
        cropping: false,
        includeBase64: false,
        compressImageQuality: 0.85,
      });
      const assets = Array.isArray(response) ? response : [response];
      handleSelectedPhotos(assets);
    } catch (err) {
      if (String(err?.code || '').includes('E_PICKER_CANCELLED')) return;
      setError(t('myClosetAddItem.unableToPickPhotos'));
    }
  };

  const pickFromCamera = async () => {
    const hasPermission = await requestCameraPermission(t);
    if (!hasPermission) {
      Alert.alert(
        t('myClosetAddItem.cameraPermissionTitle'),
        t('myClosetAddItem.cameraPermissionMessage'),
      );
      return;
    }

    try {
      const response = await ImagePicker.openCamera({
        mediaType: 'photo',
        cropping: false,
        includeBase64: false,
        compressImageQuality: 0.85,
      });
      handleSelectedPhotos([response]);
    } catch (err) {
      if (String(err?.code || '').includes('E_PICKER_CANCELLED')) return;
      setError(t('myClosetAddItem.unableToPickPhotos'));
    }
  };

  const addPhotos = () => {
    if (photos.length >= 10) {
      setError(t('myClosetAddItem.maxPhotosReached'));
      return;
    }
    Alert.alert(
      t('myClosetAddItem.addPhotosTitle'),
      t('myClosetAddItem.addPhotosMessage'),
      [
        { text: t('myClosetAddItem.takePhoto'), onPress: pickFromCamera },
        {
          text: t('myClosetAddItem.chooseFromLibrary'),
          onPress: pickFromGallery,
        },
        { text: t('myClosetAddItem.cancel'), style: 'cancel' },
      ],
    );
  };

  const handleContinue = () => {
    if (!photos.length) {
      setError(t('myClosetAddItem.addAtLeastOnePhoto'));
      return;
    }

    navigation.navigate('MyClosetAddItemDetails', {
      draft: { ...draft, photos },
      isFirstItem,
    });
  };

  return (
    <FlowShell
      navigation={navigation}
      activeStep={1}
      steps={ITEM_STEPS}
      title={itemTitle}
      subtitle={t('myClosetAddItem.subtitle')}
    >
      {() => (
        <>
          {photos.length === 0 ? (
            <>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={addPhotos}
                style={[
                  styles.photoUploadCard,
                  {
                    borderColor: withAlpha(text, isDarkMode ? 0.55 : 1),
                    backgroundColor: surfaces.inputSurface,
                  },
                ]}
              >
                <View
                  style={[
                    styles.photoHeroIconWrap,
                    {
                      backgroundColor: isDarkMode
                        ? withAlpha(text, 0.18)
                        : withAlpha(text, 0.08),
                    },
                  ]}
                >
                  <Ionicons name="images-outline" size={40} color={text} />
                </View>
                <Text style={[styles.photoHeroLabel, { color: text }]}>
                  {t('myClosetAddItem.addPhotos')}
                </Text>
                <Text style={[styles.photoHeroSubLabel, { color: tipColor }]}>
                  {t('myClosetAddItem.upToPhotos')}
                </Text>
              </TouchableOpacity>
              <InlineError message={error} />

              <View style={styles.photoTips}>
                <View style={styles.tipRow}>
                  <Ionicons name="sunny-outline" size={16} color={tipColor} />
                  <Text style={[styles.tipText, { color: tipColor }]}>
                    {t('myClosetAddItem.tipNaturalLight')}
                  </Text>
                </View>
                <View style={styles.tipRow}>
                  <Ionicons name="camera-outline" size={16} color={tipColor} />
                  <Text style={[styles.tipText, { color: tipColor }]}>
                    {t('myClosetAddItem.tipAngles')}
                  </Text>
                </View>
                <View style={styles.tipRow}>
                  <Ionicons name="scan-outline" size={16} color={tipColor} />
                  <Text style={[styles.tipText, { color: tipColor }]}>
                    {t('myClosetAddItem.tipCloseUps')}
                  </Text>
                </View>
              </View>
            </>
          ) : null}

          {photos.length ? (
            <View style={styles.selectedPhotosSection}>
              <View style={styles.selectedPhotosHeader}>
                <Text style={[styles.selectedPhotosTitle, { color: surfaces.labelColor }]}>
                  {t('myClosetAddItem.selectedPhotos')}
                </Text>
                <Text style={[styles.selectedPhotosCount, { color: tipColor }]}>
                  {photos.length}/10
                </Text>
              </View>
              <ScrollView
                style={styles.selectedPhotosScroll}
                contentContainerStyle={styles.photoThumbGrid}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                persistentScrollbar
              >
                {photos.map((photo, index) => (
                  <PhotoTile
                    key={`${photo.uri}-${index}`}
                    photo={photo}
                    onRemove={() =>
                      setPhotos(prev =>
                        prev.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  />
                ))}
              </ScrollView>
              <View style={styles.addMoreButtonsRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={pickFromGallery}
                  style={[
                    styles.addMoreMiniButton,
                    {
                      backgroundColor: surfaces.inputSurface,
                      borderColor: border || (isDarkMode ? '#333333' : '#e5e7eb'),
                    },
                  ]}
                >
                  <Ionicons name="images-outline" size={18} color={text} />
                  <Text style={[styles.addMoreMiniText, { color: surfaces.labelColor }]}>
                    {t('myClosetAddItem.addFromGallery')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={pickFromCamera}
                  style={[
                    styles.addMoreMiniButton,
                    {
                      backgroundColor: surfaces.inputSurface,
                      borderColor: border || (isDarkMode ? '#333333' : '#e5e7eb'),
                    },
                  ]}
                >
                  <Ionicons name="camera-outline" size={18} color={text} />
                  <Text style={[styles.addMoreMiniText, { color: surfaces.labelColor }]}>
                    {t('myClosetAddItem.addFromCamera')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <PrimaryButton
            label={t('myClosetAddItem.continue')}
            text={text}
            onPress={handleContinue}
          />
        </>
      )}
    </FlowShell>
  );
};

const MyClosetAddItemDetailsScreen = ({ navigation, route }) => {
  const draft = route?.params?.draft || {};
  const isFirstItem = route?.params?.isFirstItem ?? true;
  const { accent, textStyle, mutedTextStyle, cardStyle, border, icon, bgStyle, mutedText } = useAppTheme();
  const text = accent;
  const { t } = useLanguage();
  const itemTitle = isFirstItem ? t('myClosetLive.addFirstItem') : t('myClosetLive.addNewItem');
  const ITEM_STEPS = useMemo(() => getItemSteps(t), [t]);
  const itemCategoryOptions = useMemo(() => getItemCategoryOptions(t), [t]);
  const itemConditionOptions = useMemo(() => getItemConditionOptions(t), [t]);
  const [itemName, setItemName] = useState(draft.itemName || '');
  const [brand, setBrand] = useState(draft.brand || '');
  const [category, setCategory] = useState(draft.category || '');
  const [condition, setCondition] = useState(draft.condition || '');
  const [description, setDescription] = useState(draft.description || '');
  const [expandedField, setExpandedField] = useState(null);
  const [errors, setErrors] = useState({});

  const nextDraft = useMemo(
    () => ({ ...draft, itemName, brand, category, condition, description }),
    [draft, itemName, brand, category, condition, description],
  );

  const handleContinue = () => {
    const nextErrors = {};
    if (isBlank(itemName)) nextErrors.itemName = t('myClosetAddItemDetails.errors.itemNameRequired');
    if (isBlank(category)) nextErrors.category = t('myClosetAddItemDetails.errors.categoryRequired');
    if (isBlank(condition)) nextErrors.condition = t('myClosetAddItemDetails.errors.conditionRequired');
    if (isBlank(description))
      nextErrors.description = t('myClosetAddItemDetails.errors.descriptionRequired');

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    navigation.navigate('MyClosetAddItemPrice', { draft: nextDraft, isFirstItem });
  };

  return (
    <FlowShell
      navigation={navigation}
      activeStep={2}
      steps={ITEM_STEPS}
      title={itemTitle}
      subtitle={t('myClosetAddItemDetails.subtitle')}
    >
      {() => (
        <>
          <Field
            label={t('myClosetAddItemDetails.itemNameLabel')}
            placeholder={t('myClosetAddItemDetails.itemNamePlaceholder')}
            value={itemName}
            onChangeText={value => {
              setItemName(value);
              if (errors.itemName)
                setErrors(prev => ({ ...prev, itemName: null }));
            }}
            text={text}
            error={errors.itemName}
          />
          <DropdownRow
            label={t('myClosetAddItemDetails.categoryLabel')}
            placeholder={t('myClosetAddItemDetails.categoryPlaceholder')}
            value={category}
            expanded={expandedField === 'category'}
            onToggle={() =>
              setExpandedField(prev =>
                prev === 'category' ? null : 'category',
              )
            }
            onSelect={item => {
              setCategory(item);
              setExpandedField(null);
              if (errors.category)
                setErrors(prev => ({ ...prev, category: null }));
            }}
            options={itemCategoryOptions}
            text={text}
            error={errors.category}
          />
          <Field
            label={t('myClosetAddItemDetails.brandLabel')}
            placeholder={t('myClosetAddItemDetails.brandPlaceholder')}
            value={brand}
            onChangeText={setBrand}
            text={text}
          />
          <DropdownRow
            label={t('myClosetAddItemDetails.conditionLabel')}
            placeholder={t('myClosetAddItemDetails.conditionPlaceholder')}
            value={condition}
            expanded={expandedField === 'condition'}
            onToggle={() =>
              setExpandedField(prev =>
                prev === 'condition' ? null : 'condition',
              )
            }
            onSelect={item => {
              setCondition(item);
              setExpandedField(null);
              if (errors.condition)
                setErrors(prev => ({ ...prev, condition: null }));
            }}
            options={itemConditionOptions}
            text={text}
            error={errors.condition}
          />
          <Field
            label={t('myClosetAddItemDetails.descriptionLabel')}
            placeholder={t('myClosetAddItemDetails.descriptionPlaceholder')}
            value={description}
            onChangeText={value => {
              setDescription(value);
              if (errors.description)
                setErrors(prev => ({ ...prev, description: null }));
            }}
            multiline
            height={120}
            text={text}
            error={errors.description}
          />

          <PrimaryButton
            label={t('myClosetShared.continue')}
            text={text}
            onPress={handleContinue}
          />
        </>
      )}
    </FlowShell>
  );
};

const MyClosetAddItemPriceScreen = ({ navigation, route }) => {
  const draft = route?.params?.draft || {};
  const isFirstItem = route?.params?.isFirstItem ?? true;
  const { accent, textStyle, mutedTextStyle, cardStyle, border, icon, bgStyle, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const text = accent;
  const surfaces = formSurfaces(isDarkMode);
  const { t } = useLanguage();
  const userProfile = useSelector(state => state.userProfile.userProfile);
  const itemTitle = isFirstItem ? t('myClosetLive.addFirstItem') : t('myClosetLive.addNewItem');
  const ITEM_STEPS = useMemo(() => getItemSteps(t), [t]);
  const [price, setPrice] = useState(draft.price || '');
  const [quantity, setQuantity] = useState(Number(draft.quantity || 1));
  const [errors, setErrors] = useState({});
  // Personal profiles: Valens keeps 15% · Business profiles: Valens keeps 20%
  const isRegularProfile = userProfile === 'user';
  const valensFeePercent = isRegularProfile ? 15 : 20;
  const sellerKeepsPercent = 100 - valensFeePercent;

  const nextDraft = useMemo(
    () => ({ ...draft, price, quantity }),
    [draft, price, quantity],
  );

  const handleContinue = () => {
    const nextErrors = {};
    if (isBlank(price)) nextErrors.price = t('myClosetAddItemPrice.errors.priceRequired');
    if (Number(quantity) < 1) nextErrors.quantity = t('myClosetAddItemPrice.errors.quantityRequired');

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    navigation.navigate('MyClosetAddItemShipping', { draft: nextDraft, isFirstItem });
  };

  return (
    <FlowShell
      navigation={navigation}
      activeStep={3}
      steps={ITEM_STEPS}
      title={itemTitle}
      subtitle={t('myClosetAddItemPrice.subtitle')}
    >
      {() => (
        <>
          <Field
            label={t('myClosetAddItemPrice.priceLabel')}
            placeholder="0.00"
            value={price}
            onChangeText={value => {
              setPrice(value);
              if (errors.price) setErrors(prev => ({ ...prev, price: null }));
            }}
            prefix="USD"
            text={text}
            error={errors.price}
            keyboardType="numeric"
          />
          <View style={styles.quantityBlock}>
            <Text style={[styles.fieldLabel, { color: surfaces.labelColor }]}>
              {t('myClosetAddItemPrice.quantityLabel')}
            </Text>
            <QuantityStepper
              value={quantity}
              onMinus={() => setQuantity(prev => Math.max(1, prev - 1))}
              onPlus={() => setQuantity(prev => prev + 1)}
              text={text}
              bgStyle={bgStyle}
            />
            <Text style={[styles.helperLine, { color: surfaces.mutedColor }]}>
              {t('myClosetAddItemPrice.quantityHelper')}
            </Text>
          </View>

          <View style={[styles.feeCard, bgStyle, { borderColor: text }]}>
            <View style={styles.feeHeader}>
              <Text style={[styles.feeTitle, { color: text }]}>{t('myClosetAddItemPrice.feesTitle')}</Text>
              <Ionicons name="information-circle-outline" size={16} color={surfaces.mutedColor} />
            </View>
            <Text style={[styles.feeMain, { color: surfaces.inputText }]}>
              {t('myClosetAddItemPrice.feeKeepPercent', { percent: sellerKeepsPercent })}
            </Text>
            <Text style={[styles.feeText, { color: surfaces.mutedColor }]}>
              {!isRegularProfile
                ? t('myClosetAddItemPrice.feeExplainerBusiness', { fee: valensFeePercent })
                : t('myClosetAddItemPrice.feeExplainerPersonal', { fee: valensFeePercent })}
            </Text>
            <Text style={[styles.feeText, { color: surfaces.mutedColor }]}>
              {t('myClosetAddItemPrice.feeSecure')}
            </Text>
          </View>

          <PrimaryButton
            label={t('myClosetShared.continue')}
            text={text}
            onPress={handleContinue}
          />
        </>
      )}
    </FlowShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Shipping & return — step 4 of "Add item"
//
// Buyers may be offered either or both delivery methods on a single item:
//   • Shipping   – seller ships to the buyer's address
//   • Local pickup – buyer picks up in person at a seller-chosen spot/time,
//                    coordinated over Valens chat
// ─────────────────────────────────────────────────────────────────────────────
const MyClosetAddItemShippingScreen = ({ navigation, route }) => {
  const draft = route?.params?.draft || {};
  const isFirstItem = route?.params?.isFirstItem ?? true;
  const { accent, textStyle, mutedTextStyle, cardStyle, border, icon, bgStyle, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const text = accent;
  const surfaces = formSurfaces(isDarkMode);
  const { t } = useLanguage();
  const itemTitle = isFirstItem ? t('myClosetLive.addFirstItem') : t('myClosetLive.addNewItem');
  const ITEM_STEPS = useMemo(() => getItemSteps(t), [t]);
  const returnPolicyOptions = useMemo(() => getReturnPolicyOptions(t), [t]);
  const itemShippingTimeOptions = useMemo(() => getItemShippingTimeOptions(t), [t]);
  const itemShippingFeeOptions = useMemo(() => getItemShippingFeeOptions(t), [t]);

  // Delivery methods — both can be selected at once
  const [shippingEnabled, setShippingEnabled] = useState(
    draft.shippingEnabled ?? true,
  );
  const [pickupEnabled, setPickupEnabled] = useState(
    draft.pickupEnabled ?? false,
  );

  // Shipping details
  const [shippingTime, setShippingTime] = useState(draft.shippingTime || '');
  const [shippingFee, setShippingFee] = useState(draft.shippingFee || '');

  // Pickup details                                    ← ADD THESE BACK
  const [pickUpCity, setPickupCity] = useState(draft.pickUpCity || '');
  const [pickupLocation, setPickupLocation] = useState(draft.pickupLocation || '');
  const [pickupAddress, setPickupAddress] = useState(draft.pickupAddress || '');
  const [pickupCoords, setPickupCoords] = useState(null);

  const hasPlacesApi = useMemo(() => isGooglePlacesConfigured(), []);

  const [cityQuery, setCityQuery] = useState(draft.pickUpCity || '');
  const [cityPredictions, setCityPredictions] = useState([]);
  const [citySearching, setCitySearching] = useState(false);
  const [cityResolving, setCityResolving] = useState(false);
  const cityDebounceRef = useRef(null);

  const [pickupQuery, setPickupQuery] = useState(
    draft.pickupLocation
      ? `${draft.pickupLocation}${draft.pickupAddress ? `, ${draft.pickupAddress}` : ''}`
      : '',
  );
  const [pickupPredictions, setPickupPredictions] = useState([]);
  const [pickupSearching, setPickupSearching] = useState(false);
  const [pickupResolving, setPickupResolving] = useState(false);
  const pickupDebounceRef = useRef(null);
  const [pickupHours, setPickupHours] = useState(
    draft.pickupHours || DEFAULT_PICKUP_HOURS,
  );
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [buyerChatEnabled, setBuyerChatEnabled] = useState(
    draft.buyerChatEnabled ?? true,
  );

  const [returnPolicy, setReturnPolicy] = useState(draft.returnPolicy || '');

  const [expandedField, setExpandedField] = useState(null);
  const [errors, setErrors] = useState({});

  const pickupLocationOptions = useMemo(
    () => (PICKUP_LOCATIONS_BY_CITY[pickUpCity] || []).map(place => place.label),
    [pickUpCity],
  );

  const nextDraft = useMemo(
    () => ({
      ...draft,
      shippingEnabled,
      pickupEnabled,
      shippingTime,
      shippingFee,
      pickUpCity,
      pickupLocation,
      pickupAddress,
      pickupHours,
      buyerChatEnabled,
      // Kept for backwards compatibility with anything still reading these
      shippingType: shippingEnabled && pickupEnabled
        ? 'both'
        : pickupEnabled ? 'pickup' : 'ship',
      returnPolicy,
    }),
    [
      draft,
      shippingEnabled,
      pickupEnabled,
      shippingTime,
      shippingFee,
      pickUpCity,
      pickupLocation,
      pickupAddress,
      pickupHours,
      buyerChatEnabled,
      returnPolicy,
    ],
  );

  // City search
  useEffect(() => {
    if (!hasPlacesApi || expandedField !== 'pickUpCity') return undefined;
    const query = cityQuery.trim();
    if (query.length < 2) { setCityPredictions([]); return undefined; }

    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    cityDebounceRef.current = setTimeout(async () => {
      setCitySearching(true);
      try {
        const results = await searchCityPredictions(query);
        setCityPredictions(results);
      } catch {
        setCityPredictions([]);
      } finally {
        setCitySearching(false);
      }
    }, 320);

    return () => cityDebounceRef.current && clearTimeout(cityDebounceRef.current);
  }, [cityQuery, hasPlacesApi, expandedField]);

  const handleSelectCityPrediction = async prediction => {
    setCityQuery(prediction.description);
    setCityPredictions([]);
    setExpandedField(null);
    setExpandedField(null);

    setCityResolving(true);
    try {
      const details = await getPlaceDetails(prediction.id);
      const cityLabel = details.city || prediction.description;
      setPickupCity(cityLabel);
      setCityQuery(cityLabel);
      if (details.latitude != null && details.longitude != null) {
        setPickupCoords({ latitude: details.latitude, longitude: details.longitude });
      }
      // Changing city invalidates any previously chosen pickup spot
      setPickupLocation('');
      setPickupAddress('');
      setPickupQuery('');
      if (errors.pickUpCity) setErrors(prev => ({ ...prev, pickUpCity: null }));
    } catch {
      setPickupCity(prediction.description);
      setCityQuery(prediction.description);
    } finally {
      setCityResolving(false);
    }
  };

  // Pickup location search (scoped near the chosen city once available)
  useEffect(() => {
    if (!hasPlacesApi || expandedField !== 'pickupLocation' || !pickUpCity) return undefined;
    const query = pickupQuery.trim();
    if (query.length < 2) { setPickupPredictions([]); return undefined; }

    if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
    pickupDebounceRef.current = setTimeout(async () => {
      setPickupSearching(true);
      try {
        const results = await searchPlacePredictions(query, pickupCoords || undefined);
        setPickupPredictions(results);
      } catch {
        setPickupPredictions([]);
      } finally {
        setPickupSearching(false);
      }
    }, 320);

    return () => pickupDebounceRef.current && clearTimeout(pickupDebounceRef.current);
  }, [pickupQuery, hasPlacesApi, expandedField, pickUpCity, pickupCoords]);

  const handleSelectPickupPrediction = async prediction => {
    setPickupQuery(prediction.description);
    setPickupPredictions([]);
    setExpandedField(null);
    setExpandedField(null);

    setPickupResolving(true);
    try {
      const details = await getPlaceDetails(prediction.id);
      const fallbackLabel = prediction.description.split(',')[0];
      setPickupLocation(details.name || fallbackLabel);
      setPickupQuery(details.name || fallbackLabel);
      setPickupAddress(details.formattedAddress || prediction.description);
      if (errors.pickupLocation) setErrors(prev => ({ ...prev, pickupLocation: null }));
    } catch {
      setPickupLocation(prediction.description.split(',')[0]);
      setPickupAddress(prediction.description);
    } finally {
      setPickupResolving(false);
    }
  };

  const openInMaps = () => {
    if (!pickupAddress) return;
    const query = encodeURIComponent(pickupAddress);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() => { });
  };

  const toggleShipping = () => {
    setShippingEnabled(prev => {
      const next = !prev;
      // At least one delivery method must remain selected
      if (!next && !pickupEnabled) return prev;
      return next;
    });
    if (errors.delivery) setErrors(prev => ({ ...prev, delivery: null }));
  };

  const togglePickup = () => {
    setPickupEnabled(prev => {
      const next = !prev;
      if (!next && !shippingEnabled) return prev;
      return next;
    });
    if (errors.delivery) setErrors(prev => ({ ...prev, delivery: null }));
  };

  useEffect(() => {
    if (!hasPlacesApi) return undefined;

    const query = pickupQuery.trim();
    if (query.length < 2) {
      setPickupPredictions([]);
      return undefined;
    }

    if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
    pickupDebounceRef.current = setTimeout(async () => {
      setPickupSearching(true);
      try {
        const results = await searchPlacePredictions(query);
        setPickupPredictions(results);
      } catch {
        setPickupPredictions([]);
      } finally {
        setPickupSearching(false);
      }
    }, 320);

    return () => {
      if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
    };
  }, [pickupQuery, hasPlacesApi]);

  const handleSelectCityFallback = city => {
    setPickupCity(city);
    setPickupLocation('');
    setPickupAddress('');
    setExpandedField(null);
    if (errors.pickUpCity) setErrors(prev => ({ ...prev, pickUpCity: null }));
  };

  const handleSelectPickupLocationFallback = label => {
    const match = (PICKUP_LOCATIONS_BY_CITY[pickUpCity] || []).find(
      place => place.label === label,
    );
    setPickupLocation(label);
    setPickupAddress(match?.address || '');
    setExpandedField(null);
    if (errors.pickupLocation) {
      setErrors(prev => ({ ...prev, pickupLocation: null }));
    }
  };

  const previewChat = () => {
    if (navigation?.navigate) {
      // Opens the Valens chat inbox preview so the seller can see how buyers
      // will reach them to coordinate a pickup meet-up ("C," chat prefix).
      navigation.navigate('ChatPreview', {
        context: 'pickup',
        itemName: draft.itemName,
      });
      return;
    }
    Alert.alert(t('myClosetAddItemShipping.buyerChatTitle'), t('myClosetAddItemShipping.buyerChatPreviewFallback'));
  };

  const handleContinue = () => {
    const nextErrors = {};

    if (!shippingEnabled && !pickupEnabled) {
      nextErrors.delivery = t('myClosetAddItemShipping.errors.deliveryRequired');
    }
    if (shippingEnabled) {
      if (isBlank(shippingTime)) nextErrors.shippingTime = t('myClosetAddItemShipping.errors.shippingTimeRequired');
      if (isBlank(shippingFee)) nextErrors.shippingFee = t('myClosetAddItemShipping.errors.shippingFeeRequired');
    }
    if (pickupEnabled) {
      if (isBlank(pickUpCity)) nextErrors.pickUpCity = t('myClosetAddItemShipping.errors.cityRequired');
      if (isBlank(pickupLocation)) nextErrors.pickupLocation = t('myClosetAddItemShipping.errors.pickupLocationRequired');
    }
    if (isBlank(returnPolicy)) nextErrors.returnPolicy = t('myClosetAddItemShipping.errors.returnPolicyRequired');

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    navigation.navigate('MyClosetAddItemReview', { draft: nextDraft, isFirstItem });
  };

  return (
    <FlowShell
      navigation={navigation}
      activeStep={4}
      steps={ITEM_STEPS}
      title={itemTitle}
      subtitle={t('myClosetAddItemShipping.subtitle')}
    >
      {() => (
        <>
          <SectionHeader icon="cube-outline" title={t('myClosetAddItemShipping.shippingOptionsTitle')} text={text} />
          <Text style={styles.helperLineTop}>{t('myClosetAddItemShipping.shippingOptionsHelper')}</Text>

          <View style={styles.deliveryGrid}>
            <DeliveryOptionCard
              label={t('myClosetAddItemShipping.iWillShipLabel')}
              description={t('myClosetAddItemShipping.iWillShipDescription')}
              bullets={[
                t('myClosetAddItemShipping.shipBulletAddress'),
                t('myClosetAddItemShipping.shipBulletHandle'),
              ]}
              selected={shippingEnabled}
              onPress={toggleShipping}
              text={text}
              icon="cube-outline"
            />
            <DeliveryOptionCard
              label={t('myClosetOptions.shippingMethod.localPickup')}
              description={t('myClosetAddItemShipping.pickupDescription')}
              bullets={[
                t('myClosetAddItemShipping.pickupBulletBuyer'),
                t('myClosetAddItemShipping.pickupBulletNoCost'),
              ]}
              selected={pickupEnabled}
              onPress={togglePickup}
              text={text}
              icon="location-outline"
            />
          </View>
          <InlineError message={errors.delivery} />

          {shippingEnabled && pickupEnabled ? (
            <View
              style={[
                styles.bothSelectedBanner,
                isDarkMode && {
                  backgroundColor: 'rgba(34,197,94,0.15)',
                  borderColor: 'rgba(34,197,94,0.35)',
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <View>
                <Text style={[styles.bothSelectedBoldText, { color: surfaces.inputText }]}>
                  {t('myClosetAddItemShipping.bothSelectedTitle')}
                </Text>
                <Text style={[styles.bothSelectedText, { color: surfaces.mutedColor }]}>
                  {t('myClosetAddItemShipping.bothSelectedSubtitle')}
                </Text>
              </View>
            </View>
          ) : null}

          {shippingEnabled ? (
            <View style={styles.detailBlock}>
              <SectionHeader icon="cube-outline" title={t('myClosetAddItemShipping.shippingDetailsTitle')} text={text} />
              <DropdownRow
                label={t('myClosetAddItemShipping.estimatedTimeLabel')}
                placeholder={t('myClosetAddItemShipping.selectTimePlaceholder')}
                value={shippingTime}
                expanded={expandedField === 'shippingTime'}
                onToggle={() =>
                  setExpandedField(prev => (prev === 'shippingTime' ? null : 'shippingTime'))
                }
                onSelect={item => {
                  setShippingTime(item);
                  setExpandedField(null);
                  if (errors.shippingTime) setErrors(prev => ({ ...prev, shippingTime: null }));
                }}
                options={itemShippingTimeOptions}
                text={text}
                error={errors.shippingTime}
              />
              <DropdownRow
                label={t('myClosetAddItemShipping.shippingFeeLabel')}
                placeholder={t('myClosetAddItemShipping.selectFeePlaceholder')}
                value={shippingFee}
                expanded={expandedField === 'shippingFee'}
                onToggle={() =>
                  setExpandedField(prev => (prev === 'shippingFee' ? null : 'shippingFee'))
                }
                onSelect={item => {
                  setShippingFee(item);
                  setExpandedField(null);
                  if (errors.shippingFee) setErrors(prev => ({ ...prev, shippingFee: null }));
                }}
                options={itemShippingFeeOptions}
                text={text}
                error={errors.shippingFee}
              />
            </View>
          ) : null}

          {pickupEnabled ? (
            <View style={styles.detailBlock}>
              <SectionHeader
                icon="location-outline"
                title={t('myClosetAddItemShipping.localPickupDetailsTitle')}
                badge={t('myClosetOptions.shippingMethod.localPickup')}
                text={text}
              />
              {hasPlacesApi ? (
                <>
                  <PlaceFieldRow
                    icon="business-outline"
                    label={t('myClosetAddItemShipping.cityLabel')}
                    placeholder={t('myClosetAddItemShipping.cityPlaceholder')}
                    value={pickUpCity}
                    filled={Boolean(pickUpCity)}
                    loading={cityResolving}
                    expanded={expandedField === 'pickUpCity'}
                    onToggle={() => {
                      setCityQuery(pickUpCity || '');
                      setExpandedField('pickUpCity');
                    }}
                    onCollapse={() => {
                      setExpandedField(null);
                      setCityPredictions([]);
                    }}
                    text={text}
                    error={errors.pickUpCity}
                    query={cityQuery}
                    onQueryChange={value => {
                      setCityQuery(value);
                      if (errors.pickUpCity) setErrors(prev => ({ ...prev, pickUpCity: null }));
                    }}
                    predictions={cityPredictions}
                    searching={citySearching}
                    onSelectPrediction={handleSelectCityPrediction}
                    t={t}
                  />

                  <PlaceFieldRow
                    icon="location-outline"
                    label={t('myClosetAddItemShipping.pickupLocationLabel')}
                    placeholder={pickUpCity ? t('myClosetAddItemShipping.selectPickupSpot') : t('myClosetAddItemShipping.selectCityFirst')}
                    value={pickupLocation}
                    filled={Boolean(pickupLocation)}
                    loading={pickupResolving}
                    disabled={!pickUpCity}
                    expanded={expandedField === 'pickupLocation'}
                    onToggle={() => {
                      if (!pickUpCity) return;
                      setPickupQuery(pickupLocation || '');
                      setExpandedField('pickupLocation');
                    }}
                    onCollapse={() => {
                      setExpandedField(null);
                      setPickupPredictions([]);
                    }}
                    text={text}
                    error={errors.pickupLocation}
                    query={pickupQuery}
                    onQueryChange={value => {
                      setPickupQuery(value);
                      if (errors.pickupLocation) setErrors(prev => ({ ...prev, pickupLocation: null }));
                    }}
                    predictions={pickupPredictions}
                    searching={pickupSearching}
                    onSelectPrediction={handleSelectPickupPrediction}
                    t={t}
                  />

                  {pickupAddress ? (
                    <View style={styles.pickupAddressPreview}>
                      <Text style={styles.pickupAddressText}>{pickupAddress}</Text>
                      <TouchableOpacity activeOpacity={0.8} onPress={openInMaps} style={styles.viewOnMapRow}>
                        <Ionicons name="map-outline" size={14} color="#5A2386" />
                        <Text style={styles.viewOnMapText}>{t('myClosetAddItemShipping.viewOnMap')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <DropdownRow
                    label={t('myClosetAddItemShipping.cityLabel')}
                    placeholder={t('myClosetAddItemShipping.cityPlaceholder')}
                    value={pickUpCity}
                    expanded={expandedField === 'pickUpCity'}
                    onToggle={() => setExpandedField(prev => (prev === 'pickUpCity' ? null : 'pickUpCity'))}
                    onSelect={handleSelectCityFallback}
                    options={PICKUP_CITY_OPTIONS}
                    text={text}
                    error={errors.pickUpCity}
                  />
                  <DropdownRow
                    label={t('myClosetAddItemShipping.pickupLocationLabel')}
                    placeholder={pickUpCity ? t('myClosetAddItemShipping.selectPickupSpot') : t('myClosetAddItemShipping.selectCityFirst')}
                    value={pickupLocation}
                    expanded={expandedField === 'pickupLocation'}
                    onToggle={() => {
                      if (!pickUpCity) return;
                      setExpandedField(prev => (prev === 'pickupLocation' ? null : 'pickupLocation'));
                    }}
                    onSelect={handleSelectPickupLocationFallback}
                    options={pickupLocationOptions}
                    text={text}
                    error={errors.pickupLocation}
                  />
                </>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setHoursExpanded(prev => !prev)}
                style={[
                  styles.hoursRow,
                  {
                    backgroundColor: surfaces.inputSurface,
                    borderColor: withAlpha(text, isDarkMode ? 0.35 : 0.16),
                  },
                ]}
              >
                <Ionicons name="time-outline" size={16} color={text} />
                <View style={styles.hoursCopy}>
                  <Text style={[styles.hoursLabel, { color: surfaces.labelColor }]}>
                    {t('myClosetAddItemShipping.availableHoursLabel')}
                  </Text>
                  <Text style={[styles.hoursValue, { color: surfaces.mutedColor }]}>
                    {t('myClosetAddItemShipping.weekdaysAbbrev')} {pickupHours.weekdayStart} - {pickupHours.weekdayEnd}
                  </Text>
                  <Text style={[styles.hoursValue, { color: surfaces.mutedColor }]}>
                    {t('myClosetAddItemShipping.weekendsAbbrev')} {pickupHours.weekendStart} - {pickupHours.weekendEnd}
                  </Text>
                </View>
                <Ionicons
                  name={hoursExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={text}
                />
              </TouchableOpacity>

              {hoursExpanded ? (
                <View
                  style={[
                    styles.hoursEditor,
                    {
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#fafafa',
                      borderColor: surfaces.listBorder,
                    },
                  ]}
                >
                  <Text style={[styles.hoursEditorLabel, { color: surfaces.labelColor }]}>
                    {t('myClosetAddItemShipping.weekdaysLabel')}
                  </Text>
                  <View style={styles.hoursEditorRow}>
                    <View style={styles.hoursEditorField}>
                      <DropdownRow
                        label={t('myClosetAddItemShipping.opensLabel')}
                        placeholder={t('myClosetAddItemShipping.startTimePlaceholder')}
                        value={pickupHours.weekdayStart}
                        expanded={expandedField === 'weekdayStart'}
                        onToggle={() =>
                          setExpandedField(prev => (prev === 'weekdayStart' ? null : 'weekdayStart'))
                        }
                        onSelect={item => {
                          setPickupHours(prev => ({ ...prev, weekdayStart: item }));
                          setExpandedField(null);
                        }}
                        options={PICKUP_TIME_OPTIONS}
                        text={text}
                      />
                    </View>
                    <View style={styles.hoursEditorField}>
                      <DropdownRow
                        label={t('myClosetAddItemShipping.closesLabel')}
                        placeholder={t('myClosetAddItemShipping.endTimePlaceholder')}
                        value={pickupHours.weekdayEnd}
                        expanded={expandedField === 'weekdayEnd'}
                        onToggle={() =>
                          setExpandedField(prev => (prev === 'weekdayEnd' ? null : 'weekdayEnd'))
                        }
                        onSelect={item => {
                          setPickupHours(prev => ({ ...prev, weekdayEnd: item }));
                          setExpandedField(null);
                        }}
                        options={PICKUP_TIME_OPTIONS}
                        text={text}
                      />
                    </View>
                  </View>
                  <Text style={[styles.hoursEditorLabel, { color: surfaces.labelColor }]}>
                    {t('myClosetAddItemShipping.weekendsLabel')}
                  </Text>
                  <View style={styles.hoursEditorRow}>
                    <View style={styles.hoursEditorField}>
                      <DropdownRow
                        label={t('myClosetAddItemShipping.opensLabel')}
                        placeholder={t('myClosetAddItemShipping.startTimePlaceholder')}
                        value={pickupHours.weekendStart}
                        expanded={expandedField === 'weekendStart'}
                        onToggle={() =>
                          setExpandedField(prev => (prev === 'weekendStart' ? null : 'weekendStart'))
                        }
                        onSelect={item => {
                          setPickupHours(prev => ({ ...prev, weekendStart: item }));
                          setExpandedField(null);
                        }}
                        options={PICKUP_TIME_OPTIONS}
                        text={text}
                      />
                    </View>
                    <View style={styles.hoursEditorField}>
                      <DropdownRow
                        label={t('myClosetAddItemShipping.closesLabel')}
                        placeholder={t('myClosetAddItemShipping.endTimePlaceholder')}
                        value={pickupHours.weekendEnd}
                        expanded={expandedField === 'weekendEnd'}
                        onToggle={() =>
                          setExpandedField(prev => (prev === 'weekendEnd' ? null : 'weekendEnd'))
                        }
                        onSelect={item => {
                          setPickupHours(prev => ({ ...prev, weekendEnd: item }));
                          setExpandedField(null);
                        }}
                        options={PICKUP_TIME_OPTIONS}
                        text={text}
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              <View
                style={[
                  styles.chatToggleRow,
                  {
                    backgroundColor: surfaces.inputSurface,
                    borderColor: withAlpha(text, isDarkMode ? 0.28 : 0.14),
                  },
                ]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={text} />
                <View style={styles.chatToggleCopy}>
                  <Text style={[styles.chatToggleLabel, { color: surfaces.inputText }]}>
                    {t('myClosetAddItemShipping.buyerChatTitle')}
                  </Text>
                  <Text style={[styles.chatToggleSubtext, { color: surfaces.mutedColor }]}>
                    {t('myClosetAddItemShipping.buyerChatSubtitle')}
                  </Text>
                </View>
                <ToggleSwitch
                  value={buyerChatEnabled}
                  onValueChange={setBuyerChatEnabled}
                  accent={text}
                />
              </View>
              {/* {buyerChatEnabled ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={previewChat}
                  style={styles.previewChatButton}
                >
                  <Ionicons name="chatbubble-outline" size={14} color={text} />
                  <Text style={[styles.previewChatText, { color: text }]}>{t('myClosetAddItemShipping.previewChat')}</Text>
                </TouchableOpacity>
              ) : null} */}
            </View>
          ) : null}

          <View style={styles.detailBlock}>
            <DropdownRow
              label={t('myClosetAddItemShipping.returnPolicyLabel')}
              placeholder={t('myClosetAddItemShipping.selectReturnPolicyPlaceholder')}
              value={returnPolicy}
              expanded={expandedField === 'returnPolicy'}
              onToggle={() =>
                setExpandedField(prev => (prev === 'returnPolicy' ? null : 'returnPolicy'))
              }
              onSelect={item => {
                setReturnPolicy(item);
                setExpandedField(null);
                if (errors.returnPolicy) setErrors(prev => ({ ...prev, returnPolicy: null }));
              }}
              options={returnPolicyOptions}
              text={text}
              error={errors.returnPolicy}
            />
          </View>

          <PrimaryButton
            label={t('myClosetShared.continue')}
            text={text}
            onPress={handleContinue}
          />
        </>
      )}
    </FlowShell>
  );
};

const MyClosetAddItemReviewScreen = ({ navigation, route }) => {
  const draft = route?.params?.draft || {};
  const isFirstItem = route?.params?.isFirstItem ?? true;  // add
  const { accent, textStyle, mutedTextStyle, cardStyle, border, icon, bgStyle, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const text = accent;
  const surfaces = formSurfaces(isDarkMode);
  const { t } = useLanguage();
  const itemTitle = isFirstItem ? t('myClosetLive.addFirstItem') : t('myClosetLive.addNewItem');
  const ITEM_STEPS = useMemo(() => getItemSteps(t), [t]);
  const dispatch = useDispatch();
  const toast = useToast();
  const [isPublishing, setIsPublishing] = useState(false);
  const heroPhoto = draft.photos?.[0];

  const shippingEnabled = draft.shippingEnabled ?? (draft.shippingType ? draft.shippingType !== 'pickup' : true);
  const pickupEnabled = draft.pickupEnabled ?? (draft.shippingType === 'pickup' || draft.shippingType === 'both');

const deliverySummaryLines = useMemo(() => {
  const lines = [];
  if (shippingEnabled) {
    lines.push(
      `${t('myClosetOptions.shippingMethod.shipItems')}${draft.shippingFee ? ` · ${draft.shippingFee}` : ''}${draft.shippingTime ? ` · ${draft.shippingTime}` : ''
      }`,
    );
  }
  if (pickupEnabled) {
    const hours = draft.pickupHours || DEFAULT_PICKUP_HOURS;
    lines.push(
      `${t('myClosetOptions.shippingMethod.localPickup')}${draft.pickupLocation ? ` · ${draft.pickupLocation}` : ''}`,
    );
    // NEW: show pickup city if present
    if (draft.pickUpCity) lines.push(draft.pickUpCity);
    if (draft.pickupAddress) lines.push(draft.pickupAddress);
    lines.push(
      `${t('myClosetAddItemShipping.weekdaysAbbrev')} ${hours.weekdayStart}-${hours.weekdayEnd}, ${t('myClosetAddItemShipping.weekendsAbbrev')} ${hours.weekendStart}-${hours.weekendEnd}`,
    );
  }
  return lines;
}, [shippingEnabled, pickupEnabled, draft, t]);

  const parseFee = feeLabel => {
    const match = String(feeLabel || '').match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  const formatPickupHours = hours => {
    const h = hours || DEFAULT_PICKUP_HOURS;
    return `Mon-Fri ${h.weekdayStart}-${h.weekdayEnd}, Sat-Sun ${h.weekendStart}-${h.weekendEnd}`;
  };

  const publish = async () => {
    if (isPublishing) return;

    setIsPublishing(true);
    dispatch(showLoader());
    try {
      console.log('[MyCloset] Creating item with draft:', draft);
      const response = await createMyClosetItem(draft);
      console.log('[MyCloset] Create item API response:', response);
      const statusCode = response?.statusCode;

      if (statusCode === 200 || statusCode === 201) {
        navigation.navigate('MyClosetAddItemPublished', {
          draft,
          item: response?.data || response,
        });
        return;
      }

      showToastMessage(
        toast,
        'danger',
        response?.message || t('myClosetAddItemReview.publishFailure'),
      );
    } catch (error) {
      console.error(
        '[MyCloset] Create item API error:',
        error?.response?.data || error?.message || error,
      );
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || t('myClosetAddItemReview.publishFailure'),
      );
    } finally {
      setIsPublishing(false);
      dispatch(hideLoader());
    }
  };

  return (
    <FlowShell
      navigation={navigation}
      activeStep={5}
      steps={ITEM_STEPS}
      title={itemTitle}
      subtitle={t('myClosetAddItemReview.subtitle')}
    >
      {() => (
        <>
          <View
            style={[
              styles.reviewHeroCard,
              {
                backgroundColor: surfaces.inputSurface,
                borderColor: surfaces.listBorder,
              },
            ]}
          >
            {heroPhoto ? (
              <Image
                source={{ uri: heroPhoto.uri }}
                style={styles.reviewHeroImage}
              />
            ) : null}
            <View style={styles.reviewHeroCopy}>
              <Text style={[styles.reviewHeroTitle, { color: surfaces.inputText }]}>
                {draft.itemName || t('myClosetAddItemReview.placeholderItemName')}
              </Text>
              {draft.brand &&
                <Text style={[styles.reviewHeroText, { color: surfaces.mutedColor }]}>
                  {draft.brand}
                </Text>
              }
              <Text style={[styles.reviewHeroText, { color: surfaces.mutedColor }]}>
                {getConditionLabel(draft.condition, t) || t('myClosetOptions.condition.goodCondition')}
              </Text>
              <Text style={[styles.reviewHeroText, { color: surfaces.mutedColor }]}>
                ${draft.price || '120.00'}
              </Text>
              <Text style={[styles.reviewHeroText, { color: surfaces.mutedColor }]}>
                {t('myClosetAddItemReview.quantityLabel')}: {draft.quantity || 1}
              </Text>
            </View>
          </View>

          <View style={styles.reviewRows}>
            <View style={styles.reviewRow}>
              <Text style={[styles.reviewLabel, { color: surfaces.mutedColor }]}>
                {t('myClosetAddItemReview.categoryLabel')}
              </Text>
              <Text style={[styles.reviewValue, { color: surfaces.inputText }]}>
                {draft.category || t('myClosetOptions.itemCategory.womenJackets')}
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={[styles.reviewLabel, { color: surfaces.mutedColor }]}>
                {t('myClosetAddItemReview.descriptionLabel')}
              </Text>
              <Text style={[styles.reviewValue, { color: surfaces.inputText }]}>
                {draft.description ||
                  t('myClosetAddItemReview.placeholderDescription')}
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={[styles.reviewLabel, { color: surfaces.mutedColor }]}>
                {t('myClosetAddItemReview.deliveryLabel')}
              </Text>
              <View style={styles.reviewValueStack}>
                {deliverySummaryLines.length ? (
                  deliverySummaryLines.map((line, index) => (
                    <Text
                      key={`${line}-${index}`}
                      style={[styles.reviewValue, { color: surfaces.inputText }]}
                    >
                      {line}
                    </Text>
                  ))
                ) : (
                  <Text style={[styles.reviewValue, { color: surfaces.inputText }]}>
                    {t('myClosetOptions.shippingMethod.shipItems')}
                  </Text>
                )}
              </View>
            </View>
            {pickupEnabled ? (
              <View style={styles.reviewRow}>
                <Text style={[styles.reviewLabel, { color: surfaces.mutedColor }]}>
                  {t('myClosetAddItemShipping.buyerChatTitle')}
                </Text>
                <Text style={[styles.reviewValue, { color: surfaces.inputText }]}>
                  {(draft.buyerChatEnabled ?? true) ? t('myClosetShared.enabled') : t('myClosetShared.disabled')}
                </Text>
              </View>
            ) : null}
            <View style={styles.reviewRow}>
              <Text style={[styles.reviewLabel, { color: surfaces.mutedColor }]}>
                {t('myClosetAddItemReview.returnPolicyLabel')}
              </Text>
              <Text style={[styles.reviewValue, { color: surfaces.inputText }]}>
                {draft.returnPolicy || t('myClosetOptions.returnPolicy.noReturns')}
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={[styles.reviewLabel, { color: surfaces.mutedColor }]}>
                {t('myClosetAddItemReview.paymentMethodLabel')}
              </Text>
              <Text style={[styles.reviewValue, { color: surfaces.inputText }]}>
                {t('myClosetPreferences.paymentTitle')}
              </Text>
            </View>
          </View>

          <PrimaryButton
            label={isPublishing ? t('myClosetAddItemReview.publishing') : t('myClosetAddItemReview.publishButton')}
            text={text}
            onPress={publish}
            disabled={isPublishing}
          />
        </>
      )}
    </FlowShell>
  );
};

const MyClosetAddItemPublishedScreen = ({ navigation, route }) => {
  const draft = route?.params?.draft || {};
  const item = route?.params?.item || {};
  const { accent, textStyle, mutedTextStyle, cardStyle, border, icon, bgStyle, mutedText } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const text = accent;
  const surfaces = formSurfaces(isDarkMode);
  const { t } = useLanguage();
  const [publishedShopName, setPublishedShopName] = useState(item?.shopName || draft.shopName || '');
  const heroPhoto = draft.photos?.[0];
  const publishedName = item?.name || draft.itemName || t('myClosetAddItemReview.placeholderItemName');
  const publishedPrice =
    item?.price ?? draft.price ?? '120.00';
  const publishedQuantity =
    item?.quantity ?? draft.quantity ?? 1;
  const shareRef = useRef(null);

  useEffect(() => {
    let alive = true;

    const loadShopName = async () => {
      try {
        const cachedUserId = await AsyncStorage.getItem('userId');
        if (!cachedUserId) return;

        const closetRes = await getMyClosetById({ userId: cachedUserId }).catch(() => null);
        const apiCloset = unwrapMyClosetResponse(closetRes);
        const closetRecord = apiCloset?.closetDetails || apiCloset || null;
        const fetchedShopName = closetRecord?.shopName || '';

        if (alive && fetchedShopName) {
          setPublishedShopName(fetchedShopName);
        }
      } catch (error) {
        console.log('loadShopName error', error);
      }
    };

    loadShopName();

    return () => {
      alive = false;
    };
  }, []);

  const handleShareItem = async () => {
    try {
      const id = item?.id || draft?.id;
      if (!id) return;
      const cachedUserId = await AsyncStorage.getItem('userId');
      const link = `${BASE_URL}/closet/${encodeURIComponent(String(cachedUserId))}?itemId=${encodeURIComponent(String(id))}`;
      const message = t('myClosetAddItemReview.copyItemText', {
        link,
        shopName: publishedShopName,
      }) || link;
      await Share.share({ message });
    } catch (error) {
      console.log('Share error', error);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <ScrollView
        contentContainerStyle={styles.successContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.confettiLayer} pointerEvents="none">
          <View style={[styles.confettiDot, styles.confettiDotOne]} />
          <View style={[styles.confettiDot, styles.confettiDotTwo]} />
          <View style={[styles.confettiDot, styles.confettiDotThree]} />
          <View style={[styles.confettiDot, styles.confettiDotFour]} />
          <View style={[styles.confettiDot, styles.confettiDotFive]} />
        </View>

        <View style={styles.itemLiveIconWrap}>
          <View
            style={[
              styles.itemLiveIcon,
              {
                borderColor: text,
                backgroundColor: surfaces.inputSurface,
              },
            ]}
          >
            <Ionicons name="bag-handle-outline" size={36} color={text} />
          </View>
        </View>

        <Text style={[styles.successTitle, { color: text }]}>{t('myClosetAddItemPublished.title')}</Text>
        <Text style={[styles.successSubtitle, { color: surfaces.mutedColor }]}>
          {t('myClosetAddItemPublished.subtitle')}
        </Text>

        <View
          style={[
            styles.publishedCard,
            {
              backgroundColor: surfaces.inputSurface,
              borderColor: surfaces.listBorder,
            },
          ]}
        >
          {heroPhoto ? (
            <Image
              source={{ uri: heroPhoto.uri }}
              style={styles.publishedThumb}
            />
          ) : null}
          <View style={styles.publishedCopy}>
            <Text style={[styles.publishedTitle, { color: surfaces.inputText }]}>
              {publishedName}
            </Text>
            <Text style={[styles.publishedSubtitle, { color: surfaces.mutedColor }]}>
              ${publishedPrice}
            </Text>
            <Text style={[styles.publishedSubtitle, { color: surfaces.mutedColor }]}>
              {t('myClosetAddItemReview.quantityLabel')}: {publishedQuantity}
            </Text>
            <Text style={[styles.publishedSubtitle, { color: surfaces.mutedColor }]}>
              {getConditionLabel(draft.condition, t) || t('myClosetOptions.condition.goodCondition')}
            </Text>
          </View>
        </View>

        <View style={styles.nextActions}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleShareItem}
            style={[
              styles.nextActionCard,
              {
                backgroundColor: surfaces.inputSurface,
                borderColor: surfaces.listBorder,
              },
            ]}
          >
            <Ionicons name="share-social-outline" size={18} color={text} />
            <Text style={[styles.nextActionText, { color: surfaces.inputText }]}>
              {t('myClosetAddItemPublished.shareItem')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.successActions}>
          <SecondaryButton
            label={t('myClosetLive.goToCloset')}
            text={text}
            onPress={() =>
              navigation.navigate('ProfileMain', {
                screen: 'Profile',
                params: { initialTab: 'closet' },
              })
            }
          />
          <PrimaryButton
            label={t('myClosetAddItemPublished.addAnotherItem')}
            text={text}
            onPress={() =>
              navigation.navigate('MyClosetAddItemPhotos', { draft: {}, isFirstItem: false })
            }
          />
        </View>
        <ShareModal
          ref={shareRef}
          post={{
            id: item?.id || item?._id || null,
            post: {
              id: item?.id || item?._id || null,
              raiseAmount: null,
              userName: null,
            },
          }}
          postId={item?.id || item?._id || null}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export {
  MyClosetCreateShopScreen,
  MyClosetUploadLogoScreen,
  MyClosetTellUsScreen,
  MyClosetPreferencesScreen,
  MyClosetLiveScreen,
  MyClosetAddItemPhotosScreen,
  MyClosetAddItemDetailsScreen,
  MyClosetAddItemPriceScreen,
  MyClosetAddItemShippingScreen,
  MyClosetAddItemReviewScreen,
  MyClosetAddItemPublishedScreen,
};

export default MyClosetCreateShopScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 60,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSpacer: {
    width: 40,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepCircleTextActive: {
    color: '#fff',
  },
  stepConnectorLine: {
    flex: 1,
    height: 1,
    marginHorizontal: 6,
  },
  heroBlock: {
    marginTop: 18,
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: '900',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 16,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  inlineError: {
    marginTop: 6,
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
    lineHeight: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  fieldWrap: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  placeFieldSearchInline: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
    marginRight: 6,
  },
  placeFieldPredictionsBox: {
    marginTop: 4,
    marginLeft: 44,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  placeFieldNoResults: {
    fontSize: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    textAlign: 'center',
  },
  placeFieldBlock: {
    marginBottom: 14,
  },
  placeFieldTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeFieldIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  placeFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 8,
  },
  placeFieldValueBox: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  placeFieldValueBoxDisabled: {
    opacity: 0.5,
  },
  placeFieldValueBoxActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  placeFieldValueText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  placeFieldCheck: {
    width: 26,
    marginLeft: 8,
    alignItems: 'center',
  },
  placeFieldSearchingRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  pickupAddressPreview: {
    marginLeft: 44,
    marginTop: -4,
    marginBottom: 14,
  },
  pickupAddressText: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
    marginBottom: 4,
  },
  viewOnMapRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewOnMapText: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: '700',
    color: '#5A2386',
    textDecorationLine: 'underline',
  },
  fieldPrefix: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  dropdownRow: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  dropdownRowActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownText: {
    fontSize: 15,
    flex: 1,
    marginRight: 10,
  },
  dropdownList: {
    maxHeight: 150,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  dropdownListContent: {
    flexGrow: 0,
  },
  dropdownItem: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
  },
  dropdownItemSelected: {
    backgroundColor: '#f5f3ff',
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownItemTextSelected: {
    color: '#4f46e5',
  },
  featureList: {
    marginBottom: 18,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 6,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  logoHeroWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoHero: {
    width: 170,
    height: 170,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoPreviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  logoHeroLabel: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '800',
  },
  orText: {
    fontSize: 13,
    marginBottom: 12,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginVertical: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },
  shippingGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  optionCard: {
    width: '48%',
    minHeight: 108,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  optionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  optionCopy: {
    flex: 1,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  // ── New: delivery method multi-select cards ─────────────────────────────
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  sectionHeaderBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sectionHeaderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  helperLineTop: {
    fontSize: 12,
    marginBottom: 12,
  },
  deliveryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  deliveryCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  deliveryCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  checkboxBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryLabel: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 2,
  },
  deliveryDescription: {
    fontSize: 11,
    marginBottom: 8,
  },
  deliveryBulletList: {
    marginTop: 2,
  },
  deliveryBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deliveryBulletText: {
    marginLeft: 6,
    fontSize: 11,
  },
  bothSelectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf3',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  bothSelectedBoldText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    lineHeight: 17,
    color: '#000',
    fontWeight: 'bold',
  },
  bothSelectedText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    lineHeight: 17,
    color: '#000',
    fontWeight: '400',
    paddingRight: 5
  },
  detailBlock: {
    marginTop: 18,
  },
  addressPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: -6,
    marginBottom: 14,
  },
  addressPreviewText: {
    flex: 1,
    marginLeft: 6,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  hoursRow: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  hoursCopy: {
    flex: 1,
    marginLeft: 10,
  },
  hoursLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
  },
  hoursValue: {
    fontSize: 12,
  },
  hoursEditor: {
    marginTop: -6,
    marginBottom: 14,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  hoursEditorLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  hoursEditorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  hoursEditorField: {
    flex: 1,
  },
  chatToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chatToggleCopy: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  chatToggleLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  chatToggleSubtext: {
    fontSize: 11,
    lineHeight: 15,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  previewChatButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  previewChatText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '800',
  },
  reviewValueStack: {
    width: '64%',
    alignItems: 'flex-end',
  },
  paymentCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  paymentIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentCopy: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 3,
  },
  paymentSubtitle: {
    fontSize: 12,
  },
  successContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 36,
    alignItems: 'center',
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  confettiDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.75,
  },
  confettiDotOne: {
    top: 18,
    left: 26,
    backgroundColor: '#c084fc',
  },
  confettiDotTwo: {
    top: 42,
    right: 34,
    backgroundColor: '#f472b6',
  },
  confettiDotThree: {
    top: 88,
    left: 48,
    backgroundColor: '#60a5fa',
  },
  confettiDotFour: {
    top: 126,
    right: 72,
    backgroundColor: '#f59e0b',
  },
  confettiDotFive: {
    top: 166,
    left: 110,
    backgroundColor: '#34d399',
  },
  successAvatarWrap: {
    marginTop: 20,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBadge: {
    position: 'absolute',
    right: 8,
    bottom: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8
  },
  successSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  linkCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  linkCopy: {
    flex: 1,
    paddingRight: 12,
  },
  linkLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  linkValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successActions: {
    width: '100%',
  },
  itemHeaderBlock: {
    marginBottom: 14,
  },
  itemTitle: {
    fontSize: 25,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 6,
  },
  itemSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
  photoUploadCard: {
    minHeight: 250,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoHeroImage: {
    width: '100%',
    height: '100%',
    minHeight: 250,
  },
  photoHeroIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  photoHeroLabel: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  photoHeroSubLabel: {
    fontSize: 13,
  },
  photoTips: {
    marginTop: 14,
    marginBottom: 8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  selectedPhotosSection: {
    marginTop: 6,
    marginBottom: 14,
  },
  selectedPhotosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  selectedPhotosTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  selectedPhotosCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectedPhotosScroll: {
    maxHeight: 330,
  },
  photoThumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  photoTile: {
    width: '48%',
    aspectRatio: 0.82,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#f3f4f6',
  },
  addMoreButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  addMoreMiniButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  addMoreMiniText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  photoTileImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  quantityBlock: {
    marginBottom: 14,
  },
  quantityStepper: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  quantityBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBtnText: {
    fontSize: 20,
    fontWeight: '800',
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  helperLine: {
    marginTop: 6,
    fontSize: 12,
  },
  feeCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  feeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  feeTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  feeMain: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  feeText: {
    fontSize: 12,
    lineHeight: 18,
  },
  reviewHeroCard: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  reviewHeroImage: {
    width: 100,
    height: 120,
    backgroundColor: '#f3f4f6',
  },
  reviewHeroCopy: {
    flex: 1,
    padding: 8
  },
  reviewHeroTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  reviewHeroText: {
    fontSize: 12,
    marginBottom: 2,
  },
  reviewRows: {
    marginBottom: 14,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reviewLabel: {
    width: '32%',
    fontSize: 12,
    fontWeight: '700',
  },
  reviewValue: {
    width: '64%',
    fontSize: 12,
    color: '#111827',
    fontWeight: '700',
    textAlign: 'right',
  },
  itemLiveIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  itemLiveIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  publishedCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  publishedThumb: {
    width: 85,
    height: 89,
  },
  publishedCopy: {
    flex: 1,
    padding: 4,
    paddingLeft: 8
  },
  publishedTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  publishedSubtitle: {
    fontSize: 12,
    marginBottom: 2,
  },
  nextActions: {
    width: '100%',
    marginBottom: 14,
  },
  nextActionCard: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  nextActionText: {
    marginLeft: 10,
    fontSize: 13,
    fontWeight: '700',
  },
});
