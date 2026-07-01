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
import { showToastMessage } from '../../components/displaytoastmessage';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { createMyCloset, createMyClosetItem } from '../../services/myCloset';
import ShareModal from '../../components/modals/ShareModal';
import PostLocationModal from '../../components/modals/PostLocationModal';
import { getPlaceDetails, isGooglePlacesConfigured, searchPlacePredictions, searchCityPredictions } from '../../services/googlePlaces';

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

const isBlank = value => !String(value || '').trim();

const InlineError = ({ message }) =>
  message ? <Text style={styles.inlineError}>{message}</Text> : null;

const CATEGORY_OPTIONS = [
  'Clothing',
  'Accessories',
  'Shoes',
  'Bags',
  'Vintage',
  'Beauty',
  'Home Decor',
  'Others'
];

const RETURN_POLICY_OPTIONS = [
  'No returns',
  '7-day returns',
  '14-day returns',
  'Exchange only',
];

const WHO_CAN_BUY_OPTIONS = ['Everyone', 'followers'];

const STEPS = [
  {
    index: 1,
    title: 'Create your shop',
    subtitle: 'Let us set up your personal shop and make it yours.',
  },
  {
    index: 2,
    title: 'Add your shop logo',
    subtitle: 'This will represent your closet across Valens.',
  },
  {
    index: 3,
    title: 'Tell us about your closet',
    subtitle:
      'Share a short description and help people connect with your style.',
  },
  {
    index: 4,
    title: 'Set your shop preferences',
    subtitle: 'You can change these anytime later.',
  },
];

const ITEM_STEPS = [
  {
    index: 1,
    title: 'Add photos',
    subtitle: 'Show your item clearly. Good photos sell faster.',
  },
  {
    index: 2,
    title: 'Item details',
    subtitle: 'Tell buyers what your item is all about.',
  },
  {
    index: 3,
    title: 'Price & quantity',
    subtitle: 'Set a fair price and manage stock.',
  },
  {
    index: 4,
    title: 'Shipping & return',
    subtitle: 'Set your shipping and return policy.',
  },
  {
    index: 5,
    title: 'Review your item',
    subtitle: 'Make sure everything looks good.',
  },
];

const ITEM_CATEGORY_OPTIONS = [
  'Women > Jackets',
  'Women > Dresses',
  'Men > Shirts',
  'Accessories > Bags',
  'Shoes > Sneakers',
  'Home > Decor',
  'Vintage > Pieces',
  'Others'
];

const ITEM_CONDITION_OPTIONS = [
  { label: 'New', value: 'New' },
  { label: 'Used', value: 'Used' },
  { label: 'Good condition', value: 'Good_condition' },
  { label: 'Needs attention', value: 'Need_attention' },
];
const ITEM_SHIPPING_METHOD_OPTIONS = [
  { label: 'Ship items', value: 'ship_items' },
  { label: 'Local pickup', value: 'local_pick' },
];
const SHIPPING_CHOICES = [
  {
    label: 'Ship items',
    description: 'I will ship to buyers',
    value: 'ship_items',
    icon: 'cube-outline',
  },
  {
    label: 'Local pickup',
    description: 'Buyers pick up locally',
    value: 'local_pick',
    icon: 'location-outline',
  },
];
const ITEM_SHIPPING_TIME_OPTIONS = [
  '1 - 3 business days',
  '3 - 5 business days',
  '5 - 7 business days',
];

// ── New: item-level shipping/pickup constants ───────────────────────────────
const ITEM_SHIPPING_FEE_OPTIONS = [
  'Free shipping',
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

const getConditionLabel = value => {
  switch (String(value || '').trim()) {
    case 'New':
      return 'New';
    case 'Used':
      return 'Used';
    case 'Good_condition':
      return 'Good condition';
    case 'Need_attention':
      return 'Needs attention';
    default:
      return value || '';
  }
};

const getShippingOptionLabel = value => {
  switch (String(value || '').trim()) {
    case 'ship_items':
      return 'Ship items';
    case 'local_pick':
      return 'Local pickup';
    default:
      return value || '';
  }
};

const FlowShell = ({
  navigation,
  activeStep,
  steps,
  title,
  subtitle,
  children,
}) => {
  const { bgStyle, textStyle, text, cardStyle } = useAppTheme();
  const currentStep = steps.find(step => step.index === activeStep) || steps[0];

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
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: text }]}>{title}</Text>
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
                    { borderColor: withAlpha(text, 0.45) },
                    (active || completed) && { backgroundColor: text },
                  ]}
                >
                  <Text
                    style={[
                      styles.stepCircleText,
                      (active || completed) && styles.stepCircleTextActive,
                    ]}
                  >
                    {step.index}
                  </Text>
                </View>
                {index < steps.length - 1 ? (
                  <View style={[styles.stepConnectorLine, { backgroundColor: text }]} />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>

        <View style={styles.heroBlock}>
          <Text style={[styles.heroTitle, textStyle]}>{currentStep.title}</Text>
          <Text style={[styles.heroSubtitle, textStyle]}>
            {subtitle || currentStep.subtitle}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            cardStyle,
            { borderColor: withAlpha(text, 0.14) },
          ]}
        >
          {children({ text })}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const Shell = ({ navigation, activeStep, children }) => {
  const { bgStyle, textStyle, text, cardStyle } = useAppTheme();
  const currentStep = STEPS.find(step => step.index === activeStep) || STEPS[0];

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
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: text }]}>My Closet</Text>
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
                    { borderColor: withAlpha(text, 0.45) },
                    (active || completed) && { backgroundColor: text },
                  ]}
                >
                  <Text
                    style={[
                      styles.stepCircleText,
                      (active || completed) && styles.stepCircleTextActive,
                    ]}
                  >
                    {step.index}
                  </Text>
                </View>
                {index < STEPS.length - 1 ? (
                  <View style={[styles.stepConnectorLine, { backgroundColor: text }]} />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>

        <View style={styles.heroBlock}>
          <Text style={[styles.heroTitle, textStyle]}>{currentStep.title}</Text>
          <Text style={[styles.heroSubtitle, textStyle]}>
            {currentStep.subtitle}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            cardStyle,
            { borderColor: withAlpha(text, 0.14) },
          ]}
        >
          {children({ text })}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const PrimaryButton = ({ label, onPress, text, disabled = false }) => (
  <TouchableOpacity
    activeOpacity={0.9}
    onPress={disabled ? undefined : onPress}
    disabled={disabled}
    style={[
      styles.primaryButton,
      { backgroundColor: text },
      disabled && styles.buttonDisabled,
    ]}
  >
    <Text style={styles.primaryButtonText}>{label}</Text>
  </TouchableOpacity>
);

const SecondaryButton = ({ label, onPress, text }) => (
  <TouchableOpacity
    activeOpacity={0.9}
    onPress={onPress}
    style={[styles.secondaryButton, { borderColor: withAlpha(text, 0.25) }]}
  >
    <Text style={[styles.secondaryButtonText, { color: text }]}>{label}</Text>
  </TouchableOpacity>
);

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
}) => (
  <View style={styles.fieldBlock}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View
      style={[
        styles.fieldWrap,
        { borderColor: error ? '#dc2626' : withAlpha(text, 0.16) },
      ]}
    >
      {prefix ? <Text style={styles.fieldPrefix}>{prefix}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#a1a1aa"
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.fieldInput, multiline && { minHeight: height || 92 }]}
      />
    </View>
    <InlineError message={error} />
  </View>
);

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
}) => (
  <View style={styles.placeFieldBlock}>
    <View style={styles.placeFieldTopRow}>
      <View style={styles.placeFieldIconWrap}>
        <Ionicons name={icon} size={17} color="#5A2386" />
      </View>
      <Text style={styles.placeFieldLabel} numberOfLines={1}>
        {label}
      </Text>

      {expanded ? (
        <View
          style={[
            styles.placeFieldValueBox,
            styles.placeFieldValueBoxActive,
            { borderColor: error ? '#dc2626' : withAlpha(text, 0.16) },
          ]}
        >
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder={`Search ${label.toLowerCase()}...`}
            placeholderTextColor="#a1a1aa"
            autoFocus
            style={styles.placeFieldSearchInline}
          />
          <TouchableOpacity onPress={onCollapse} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-up" size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={disabled ? undefined : onToggle}
          style={[
            styles.placeFieldValueBox,
            disabled && styles.placeFieldValueBoxDisabled,
            { borderColor: error ? '#dc2626' : withAlpha(text, 0.16) },
          ]}
        >
          <Text
            style={[styles.placeFieldValueText, !value && { color: '#a1a1aa' }]}
            numberOfLines={1}
          >
            {value || placeholder}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#6b7280" />
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
      <View style={styles.placeFieldPredictionsBox}>
        {searching ? (
          <View style={styles.placeFieldSearchingRow}>
            <ActivityIndicator size="small" color="#5A2386" />
          </View>
        ) : null}
        {predictions.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.8}
            onPress={() => onSelectPrediction(item)}
            style={[
              styles.dropdownItem,
              index !== predictions.length - 1 && styles.dropdownItemBorder,
            ]}
          >
            <Text style={styles.dropdownItemText} numberOfLines={2}>
              {item.description}
            </Text>
          </TouchableOpacity>
        ))}
        {!searching && query.trim().length >= 2 && predictions.length === 0 ? (
          <Text style={styles.placeFieldNoResults}>No matches found</Text>
        ) : null}
      </View>
    ) : null}

    <InlineError message={error} />
  </View>
);

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
  const selectedOption = options.find(item => getOptionValue(item) === value);
  const displayValue = selectedOption ? getOptionLabel(selectedOption) : value;

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onToggle}
        style={[
          styles.dropdownRow,
          expanded && styles.dropdownRowActive,
          { borderColor: error ? '#dc2626' : withAlpha(text, 0.16) },
        ]}
      >
        <Text style={[styles.dropdownText, !value && { color: '#a1a1aa' }]}>
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
          style={styles.dropdownList}
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
                  index !== options.length - 1 && styles.dropdownItemBorder,
                  selected && styles.dropdownItemSelected,
                ]}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    selected && styles.dropdownItemTextSelected,
                  ]}
                >
                  {itemLabel}
                </Text>
                {selected ? (
                  <Ionicons name="checkmark" size={16} color="#4f46e5" />
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

const OptionCard = ({ label, description, selected, onPress, text, icon }) => (
  <TouchableOpacity
    activeOpacity={0.9}
    onPress={onPress}
    style={[
      styles.optionCard,
      {
        borderColor: selected ? text : withAlpha(text, 0.14),
        backgroundColor: selected ? mixWithWhite(text, 0.93) : '#fff',
      },
    ]}
  >
    <View style={styles.optionIconWrap}>
      <Ionicons name={icon} size={18} color={text} />
    </View>
    <View style={styles.optionCopy}>
      <Text style={styles.optionLabel}>{label}</Text>
      <Text style={styles.optionDescription}>{description}</Text>
    </View>
    <Ionicons
      name={selected ? 'radio-button-on' : 'radio-button-off'}
      size={20}
      color={text}
    />
  </TouchableOpacity>
);

// ── New: multi-select delivery method card with checkbox + inline bullet list
const DeliveryOptionCard = ({
  label,
  description,
  bullets,
  selected,
  onPress,
  text,
  icon,
}) => (
  <TouchableOpacity
    activeOpacity={0.9}
    onPress={onPress}
    style={[
      styles.deliveryCard,
      {
        borderColor: selected ? text : withAlpha(text, 0.14),
        backgroundColor: selected ? mixWithWhite(text, 0.94) : '#fff',
      },
    ]}
  >
    <View style={styles.deliveryCardTopRow}>
      <View style={styles.optionIconWrap}>
        <Ionicons name={icon} size={18} color={text} />
      </View>
      <View
        style={[
          styles.checkboxBadge,
          selected
            ? { backgroundColor: text }
            : { backgroundColor: '#fff', borderWidth: 1, borderColor: withAlpha(text, 0.3) },
        ]}
      >
        {selected ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
      </View>
    </View>
    <Text style={styles.deliveryLabel}>{label}</Text>
    <Text style={styles.deliveryDescription}>{description}</Text>
    {bullets?.length ? (
      <View style={styles.deliveryBulletList}>
        {bullets.map(bullet => (
          <View key={bullet} style={styles.deliveryBulletRow}>
            <Ionicons name={bullet.icon || 'ellipse'} size={4} color="#9ca3af" />
            <Text style={styles.deliveryBulletText}>{bullet}</Text>
          </View>
        ))}
      </View>
    ) : null}
  </TouchableOpacity>
);

// ── New: simple pill-style toggle switch, mirrors the buyer chat toggle
const ToggleSwitch = ({ value, onValueChange, accent }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={() => onValueChange(!value)}
    style={[
      styles.toggleTrack,
      { backgroundColor: value ? accent : '#e5e7eb' },
    ]}
  >
    <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
  </TouchableOpacity>
);

// ── New: labelled section header used inside the shipping & return step
const SectionHeader = ({ icon, title, badge, text }) => (
  <View style={styles.sectionHeaderRow}>
    {icon ? <Ionicons name={icon} size={16} color={text} /> : null}
    <Text style={[styles.sectionHeaderTitle, icon && { marginLeft: 6 }]}>{title}</Text>
    {badge ? (
      <View style={styles.sectionHeaderBadge}>
        <Text style={styles.sectionHeaderBadgeText}>{badge}</Text>
      </View>
    ) : null}
  </View>
);

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
  const { text } = useAppTheme();
  const nextDraft = useMemo(
    () => ({ ...draft, shopName, username }),
    [draft, shopName, username],
  );

  const handleContinue = () => {
    const nextErrors = {};
    if (isBlank(shopName)) nextErrors.shopName = 'Shop name is required.';
    if (isBlank(username)) nextErrors.username = 'Shop username is required.';

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
            label="Your shop name"
            placeholder="e.g. John's Closet"
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
            label="Shop username"
            placeholder="yourname"
            value={username}
            onChangeText={value => {
              setUsername(value);
              if (errors.username) {
                setErrors(prev => ({ ...prev, username: null }));
              }
            }}
            prefix="valens.app/"
            text={text}
            error={errors.username}
          />

          <View style={styles.featureList}>
            <View style={styles.featureRow}>
              <Ionicons name="bulb-outline" size={18} color={text} />
              <Text style={styles.featureText}>Easy to find</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="pricetag-outline" size={18} color={text} />
              <Text style={styles.featureText}>Build your brand</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="people-outline" size={18} color={text} />
              <Text style={styles.featureText}>Grow your community</Text>
            </View>
          </View>

          <PrimaryButton
            label="Continue"
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
  const { text } = useAppTheme();

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
      setError('Unable to open photo library.');
    }
  };

  const pickFromCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        'Camera Permission',
        'Camera access is required to take a logo photo.',
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
      setError('Unable to open camera.');
    }
  };

  const handleContinue = () => {
    if (!logoChosen || !logo?.uri) {
      setError('Please upload a logo to continue.');
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
                  borderColor: withAlpha(text, 0.35),
                  backgroundColor: mixWithWhite(text, 0.94),
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
                  <Text style={[styles.logoHeroLabel, { color: text }]}>Upload logo</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.orText}>or</Text>
          </View>
          <SecondaryButton
            label="Choose from library"
            text={text}
            onPress={pickFromLibrary}
          />
          <InlineError message={error} />
          <Text style={styles.helperText}>
            We recommend a square or hexagon image at least 500x500px.
          </Text>

          <PrimaryButton
            label="Continue"
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
  const { text } = useAppTheme();

  const nextDraft = useMemo(
    () => ({ ...draft, description, category, location }),
    [draft, description, category, location],
  );

  const handleContinue = () => {
    const nextErrors = {};
    if (isBlank(description)) {
      nextErrors.description = 'Description is required.';
    }
    if (isBlank(category)) {
      nextErrors.category = 'Category is required.';
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
            label="Shop description"
            placeholder="e.g. I love timeless pieces, minimal style and unique finds..."
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
            label="Shop category"
            placeholder="Select a category"
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
            options={CATEGORY_OPTIONS}
            text={text}
            error={errors.category}
          />
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Location (optional)</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setLocationModalVisible(true)}
              style={[
                styles.dropdownRow,
                { borderColor: withAlpha(text, 0.16) },
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
                  !location.trim() && { color: '#a1a1aa' },
                ]}
                numberOfLines={1}
              >
                {location.trim() || 'Select your location'}
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
            label="Continue"
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
  const { text } = useAppTheme();
  const userProfile = useSelector(state => state.userProfile.userProfile);
  const nextDraft = useMemo(
    () => ({ ...draft, shipping, returnPolicy, paymentMethod, whoCanBuy }),
    [draft, shipping, returnPolicy, paymentMethod, whoCanBuy],
  );

  const handleContinue = async () => {
    const nextErrors = {};

    if (shipping.length == 0) {
      nextErrors.shipping = 'Please select at least one shipping option.';
    }

    if (isBlank(returnPolicy)) {
      nextErrors.returnPolicy = 'Return policy is required.';
    }
    if (isBlank(whoCanBuy)) {
      nextErrors.whoCanBuy = 'Please choose who can buy.';
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
          response?.message || 'My Closet created successfully.',
        );
        navigation.navigate('MyClosetLive', { draft: nextDraft });
        return;
      }

      showToastMessage(
        toast,
        'danger',
        response?.message || 'Failed to create My Closet.',
      );
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || 'Failed to create My Closet.',
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
          <Text style={styles.sectionLabel}>Shipping options</Text>
          <View style={styles.shippingGrid}>
            {SHIPPING_CHOICES.map(choice => {
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
            label="Return policy"
            placeholder="Select a return policy"
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
            options={RETURN_POLICY_OPTIONS}
            text={text}
            error={errors.returnPolicy}
          />

          <View
            style={[
              styles.paymentCard,
              {
                borderColor: withAlpha(text, 0.16),
                backgroundColor: mixWithWhite(text, 0.95),
              },
            ]}
          >
            <View style={styles.paymentIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={text}
              />
            </View>
            <View style={styles.paymentCopy}>
              <Text style={styles.paymentTitle}>Valens Secure Checkout</Text>
              <Text style={styles.paymentSubtitle}>
                Get paid securely on Valens
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={text} />
          </View>

          <DropdownRow
            label="Who can buy?"
            placeholder="Select who can buy"
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
            options={WHO_CAN_BUY_OPTIONS}
            text={text}
            error={errors.whoCanBuy}
          />

          <PrimaryButton
            label="Launch My Closet"
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
  const itemTitle = isFirstItem ? 'Add My First Item' : 'Add New Item';
  const { text, bgStyle } = useAppTheme();
  const toast = useToast();
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
    showToastMessage(toast, 'success', 'Shop link copied to clipboard');
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
              { borderColor: withAlpha(text, 0.18), backgroundColor: '#fff' },
            ]}
          >
            <Ionicons name="bag-handle-outline" size={28} color={text} />
          </View>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
        </View>

        <Text style={[styles.successTitle, { color: text }]}>{userProfile == 'user' ? 'Your Closet is Live!' : 'Your Shop is Live!'}</Text>
        <Text style={styles.successSubtitle}>
          Your personal shop is ready. Start adding items and share your style.
        </Text>

        <View style={[styles.linkCard, { borderColor: withAlpha(text, 0.16) }]}>
          <View style={styles.linkCopy}>
            <Text style={styles.linkLabel}>Your shop link</Text>
            <Text style={styles.linkValue}>{shopLink}</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={copyShopLink}
            style={styles.copyButton}
          >
            <Ionicons name="copy-outline" size={18} color={text} />
          </TouchableOpacity>
        </View>

        <View style={styles.successActions}>
          <SecondaryButton
            label={userProfile == 'user' ? "Go to My Closet" : "Go to My Shop"}
            text={text}
            onPress={() => {
              navigation.navigate('Profile', { initialTab: 'closet' })
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

const QuantityStepper = ({ value, onMinus, onPlus, text, bgStyle }) => (
  <View style={styles.quantityStepper}>
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onMinus}
      style={[styles.quantityBtn, bgStyle]}
    >
      <Text style={[styles.quantityBtnText, { color: text }]}>-</Text>
    </TouchableOpacity>
    <Text style={styles.quantityValue}>{value}</Text>
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPlus}
      style={[styles.quantityBtn, bgStyle]}
    >
      <Text style={[styles.quantityBtnText, { color: text }]}>+</Text>
    </TouchableOpacity>
  </View>
);

const MyClosetAddItemPhotosScreen = ({ navigation, route }) => {
  const draft = route?.params?.draft || {};
  const isFirstItem = route?.params?.isFirstItem ?? true;  // add
  const itemTitle = isFirstItem ? 'Add My First Item' : 'Add New Item';
  const [photos, setPhotos] = useState(draft.photos || []);
  const [error, setError] = useState('');
  const { text } = useAppTheme();
  const { t } = useLanguage();

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
    const hasPermission = await requestCameraPermission();
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
                style={[styles.photoUploadCard, { borderColor: text }]}
              >
                <View style={styles.photoHeroIconWrap}>
                  <Ionicons name="images-outline" size={40} color={text} />
                </View>
                <Text style={[styles.photoHeroLabel, { color: text }]}>
                  {t('myClosetAddItem.addPhotos')}
                </Text>
                <Text style={styles.photoHeroSubLabel}>
                  {t('myClosetAddItem.upToPhotos')}
                </Text>
              </TouchableOpacity>
              <InlineError message={error} />

              <View style={styles.photoTips}>
                <View style={styles.tipRow}>
                  <Ionicons name="sunny-outline" size={16} color={text} />
                  <Text style={styles.tipText}>
                    {t('myClosetAddItem.tipNaturalLight')}
                  </Text>
                </View>
                <View style={styles.tipRow}>
                  <Ionicons name="camera-outline" size={16} color={text} />
                  <Text style={styles.tipText}>
                    {t('myClosetAddItem.tipAngles')}
                  </Text>
                </View>
                <View style={styles.tipRow}>
                  <Ionicons name="scan-outline" size={16} color={text} />
                  <Text style={styles.tipText}>
                    {t('myClosetAddItem.tipCloseUps')}
                  </Text>
                </View>
              </View>
            </>
          ) : null}

          {photos.length ? (
            <View style={styles.selectedPhotosSection}>
              <View style={styles.selectedPhotosHeader}>
                <Text style={styles.selectedPhotosTitle}>
                  {t('myClosetAddItem.selectedPhotos')}
                </Text>
                <Text style={styles.selectedPhotosCount}>
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
                  style={styles.addMoreMiniButton}
                >
                  <Ionicons name="images-outline" size={18} color={text} />
                  <Text style={styles.addMoreMiniText}>
                    {t('myClosetAddItem.addFromGallery')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={pickFromCamera}
                  style={styles.addMoreMiniButton}
                >
                  <Ionicons name="camera-outline" size={18} color={text} />
                  <Text style={styles.addMoreMiniText}>
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
  const itemTitle = isFirstItem ? 'Add My First Item' : 'Add New Item';
  const [itemName, setItemName] = useState(draft.itemName || '');
  const [brand, setBrand] = useState(draft.brand || '');
  const [category, setCategory] = useState(draft.category || '');
  const [condition, setCondition] = useState(draft.condition || '');
  const [description, setDescription] = useState(draft.description || '');
  const [expandedField, setExpandedField] = useState(null);
  const [errors, setErrors] = useState({});
  const { text } = useAppTheme();

  const nextDraft = useMemo(
    () => ({ ...draft, itemName, brand, category, condition, description }),
    [draft, itemName, brand, category, condition, description],
  );

  const handleContinue = () => {
    const nextErrors = {};
    if (isBlank(itemName)) nextErrors.itemName = 'Item name is required.';
    if (isBlank(category)) nextErrors.category = 'Category is required.';
    if (isBlank(condition)) nextErrors.condition = 'Condition is required.';
    if (isBlank(description))
      nextErrors.description = 'Description is required.';

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
      subtitle="Tell buyers what your item is all about."
    >
      {() => (
        <>
          <Field
            label="Item name"
            placeholder="e.g. Vintage Leather Jacket"
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
            label="Category"
            placeholder="Select a category"
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
            options={ITEM_CATEGORY_OPTIONS}
            text={text}
            error={errors.category}
          />
          <Field
            label="Brand (optional)"
            placeholder="e.g. Zara"
            value={brand}
            onChangeText={setBrand}
            text={text}
          />
          <DropdownRow
            label="Condition"
            placeholder="Select condition"
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
            options={ITEM_CONDITION_OPTIONS}
            text={text}
            error={errors.condition}
          />
          <Field
            label="Description"
            placeholder="Describe your item, size, color, material..."
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
            label="Continue"
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
  const itemTitle = isFirstItem ? 'Add My First Item' : 'Add New Item';
  const [price, setPrice] = useState(draft.price || '');
  const [quantity, setQuantity] = useState(Number(draft.quantity || 1));
  const [errors, setErrors] = useState({});
  const { text, bgStyle } = useAppTheme();

  const nextDraft = useMemo(
    () => ({ ...draft, price, quantity }),
    [draft, price, quantity],
  );

  const handleContinue = () => {
    const nextErrors = {};
    if (isBlank(price)) nextErrors.price = 'Price is required.';
    if (Number(quantity) < 1) nextErrors.quantity = 'Quantity is required.';

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
      subtitle="Set a fair price and manage stock."
    >
      {() => (
        <>
          <Field
            label="Price"
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
            <Text style={styles.fieldLabel}>Quantity</Text>
            <QuantityStepper
              value={quantity}
              onMinus={() => setQuantity(prev => Math.max(1, prev - 1))}
              onPlus={() => setQuantity(prev => prev + 1)}
              text={text}
              bgStyle={bgStyle}
            />
            <Text style={styles.helperLine}>
              How many of this item do you have?
            </Text>
          </View>

          <View style={[styles.feeCard, bgStyle, { borderColor: text }]}>
            <View style={styles.feeHeader}>
              <Text style={[styles.feeTitle, { color: text }]}>Fees & Payout</Text>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#6b7280"
              />
            </View>
            <Text style={styles.feeMain}>You keep 90%</Text>
            <Text style={styles.feeText}>
              We take a small fee when your item sells.
            </Text>
            <Text style={styles.feeText}>Secure payments. Fast payouts.</Text>
          </View>

          <PrimaryButton
            label="Continue"
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
  const itemTitle = isFirstItem ? 'Add My First Item' : 'Add New Item';
  const { text } = useAppTheme();

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
  const [pickupCity, setPickupCity] = useState(draft.pickupCity || '');
  const [pickupLocation, setPickupLocation] = useState(draft.pickupLocation || '');
  const [pickupAddress, setPickupAddress] = useState(draft.pickupAddress || '');
  const [pickupCoords, setPickupCoords] = useState(null);

  const hasPlacesApi = useMemo(() => isGooglePlacesConfigured(), []);

  const [cityQuery, setCityQuery] = useState(draft.pickupCity || '');
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
    () => (PICKUP_LOCATIONS_BY_CITY[pickupCity] || []).map(place => place.label),
    [pickupCity],
  );

  const nextDraft = useMemo(
    () => ({
      ...draft,
      shippingEnabled,
      pickupEnabled,
      shippingTime,
      shippingFee,
      pickupCity,
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
      pickupCity,
      pickupLocation,
      pickupAddress,
      pickupHours,
      buyerChatEnabled,
      returnPolicy,
    ],
  );

  // City search
  useEffect(() => {
    if (!hasPlacesApi || expandedField !== 'pickupCity') return undefined;
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
      if (errors.pickupCity) setErrors(prev => ({ ...prev, pickupCity: null }));
    } catch {
      setPickupCity(prediction.description);
      setCityQuery(prediction.description);
    } finally {
      setCityResolving(false);
    }
  };

  // Pickup location search (scoped near the chosen city once available)
  useEffect(() => {
    if (!hasPlacesApi || expandedField !== 'pickupLocation' || !pickupCity) return undefined;
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
  }, [pickupQuery, hasPlacesApi, expandedField, pickupCity, pickupCoords]);

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

  const handleSelectCity = city => {
    setPickupCity(city);
    setPickupLocation('');
    setPickupAddress('');
    setExpandedField(null);
    if (errors.pickupCity) setErrors(prev => ({ ...prev, pickupCity: null }));
  };

  const handleSelectPickupLocation = label => {
    const match = (PICKUP_LOCATIONS_BY_CITY[pickupCity] || []).find(
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
    Alert.alert('Buyer chat', 'Buyers will message you here to arrange pickup.');
  };

  const handleContinue = () => {
    const nextErrors = {};

    if (!shippingEnabled && !pickupEnabled) {
      nextErrors.delivery = 'Select at least one delivery method.';
    }
    if (shippingEnabled) {
      if (isBlank(shippingTime)) nextErrors.shippingTime = 'Estimated shipping time is required.';
      if (isBlank(shippingFee)) nextErrors.shippingFee = 'Shipping fee is required.';
    }
    if (pickupEnabled) {
      if (isBlank(pickupCity)) nextErrors.pickupCity = 'City is required.';
      if (isBlank(pickupLocation)) nextErrors.pickupLocation = 'Pickup location is required.';
    }
    if (isBlank(returnPolicy)) nextErrors.returnPolicy = 'Return policy is required.';

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
      subtitle="Set your shipping and return policy."
    >
      {() => (
        <>
          <SectionHeader icon="cube-outline" title="Shipping options" text={text} />
          <Text style={styles.helperLineTop}>Choose how buyers will receive this item.</Text>

          <View style={styles.deliveryGrid}>
            <DeliveryOptionCard
              label="I'll ship"
              description="Ship to buyers"
              bullets={['Buyer provides address', 'You handle shipping']}
              selected={shippingEnabled}
              onPress={toggleShipping}
              text={text}
              icon="cube-outline"
            />
            <DeliveryOptionCard
              label="Local pickup"
              description="Buyers pick up locally"
              bullets={['Buyer picks up', 'No shipping cost']}
              selected={pickupEnabled}
              onPress={togglePickup}
              text={text}
              icon="location-outline"
            />
          </View>
          <InlineError message={errors.delivery} />

          {shippingEnabled && pickupEnabled ? (
            <View style={styles.bothSelectedBanner}>
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <View>
                <Text style={styles.bothSelectedBoldText}>
                  Both options selected
                </Text>
                <Text style={styles.bothSelectedText}>
                  Buyers can choose their preferred delivery method at checkout.
                </Text>
              </View>
            </View>
          ) : null}

          {shippingEnabled ? (
            <View style={styles.detailBlock}>
              <SectionHeader icon="cube-outline" title="Shipping details" text={text} />
              <DropdownRow
                label="Estimated shipping time"
                placeholder="Select time"
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
                options={ITEM_SHIPPING_TIME_OPTIONS}
                text={text}
                error={errors.shippingTime}
              />
              <DropdownRow
                label="Shipping fee"
                placeholder="Select fee"
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
                options={ITEM_SHIPPING_FEE_OPTIONS}
                text={text}
                error={errors.shippingFee}
              />
            </View>
          ) : null}

          {pickupEnabled ? (
            <View style={styles.detailBlock}>
              <SectionHeader
                icon="location-outline"
                title="Local pickup details"
                badge="Local pickup"
                text={text}
              />
              {hasPlacesApi ? (
                <>
                  <PlaceFieldRow
                    icon="business-outline"
                    label="City"
                    placeholder="Select your city"
                    value={pickupCity}
                    filled={Boolean(pickupCity)}
                    loading={cityResolving}
                    expanded={expandedField === 'pickupCity'}
                    onToggle={() => {
                      setCityQuery(pickupCity || '');
                      setExpandedField('pickupCity');
                    }}
                    onCollapse={() => {
                      setExpandedField(null);
                      setCityPredictions([]);
                    }}
                    text={text}
                    error={errors.pickupCity}
                    query={cityQuery}
                    onQueryChange={value => {
                      setCityQuery(value);
                      if (errors.pickupCity) setErrors(prev => ({ ...prev, pickupCity: null }));
                    }}
                    predictions={cityPredictions}
                    searching={citySearching}
                    onSelectPrediction={handleSelectCityPrediction}
                  />

                  <PlaceFieldRow
                    icon="location-outline"
                    label="Pickup location"
                    placeholder={pickupCity ? 'Select a pickup spot' : 'Select a city first'}
                    value={pickupLocation}
                    filled={Boolean(pickupLocation)}
                    loading={pickupResolving}
                    disabled={!pickupCity}
                    expanded={expandedField === 'pickupLocation'}
                    onToggle={() => {
                      if (!pickupCity) return;
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
                  />

                  {pickupAddress ? (
                    <View style={styles.pickupAddressPreview}>
                      <Text style={styles.pickupAddressText}>{pickupAddress}</Text>
                      <TouchableOpacity activeOpacity={0.8} onPress={openInMaps} style={styles.viewOnMapRow}>
                        <Ionicons name="map-outline" size={14} color="#5A2386" />
                        <Text style={styles.viewOnMapText}>View on map</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <DropdownRow
                    label="City"
                    placeholder="Select your city"
                    value={pickupCity}
                    expanded={expandedField === 'pickupCity'}
                    onToggle={() => setExpandedField(prev => (prev === 'pickupCity' ? null : 'pickupCity'))}
                    onSelect={handleSelectCityFallback}
                    options={PICKUP_CITY_OPTIONS}
                    text={text}
                    error={errors.pickupCity}
                  />
                  <DropdownRow
                    label="Pickup location"
                    placeholder={pickupCity ? 'Select a pickup spot' : 'Select a city first'}
                    value={pickupLocation}
                    expanded={expandedField === 'pickupLocation'}
                    onToggle={() => {
                      if (!pickupCity) return;
                      setExpandedField(prev => (prev === 'pickupLocation' ? null : 'pickupLocation'));
                    }}
                    onSelect={handleSelectPickupLocationFallback}
                    options={pickupLocationOptions}
                    text={text}
                    error={errors.pickupLocation}
                  />
                </>
              )}
              {pickupAddress ? (
                <View style={styles.addressPreviewRow}>
                  <Ionicons name="pin-outline" size={14} color="#6b7280" />
                  <Text style={styles.addressPreviewText}>{pickupAddress}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setHoursExpanded(prev => !prev)}
                style={styles.hoursRow}
              >
                <Ionicons name="time-outline" size={16} color={text} />
                <View style={styles.hoursCopy}>
                  <Text style={styles.hoursLabel}>Available hours</Text>
                  <Text style={styles.hoursValue}>
                    Mon - Fri {pickupHours.weekdayStart} - {pickupHours.weekdayEnd}
                  </Text>
                  <Text style={styles.hoursValue}>
                    Sat - Sun {pickupHours.weekendStart} - {pickupHours.weekendEnd}
                  </Text>
                </View>
                <Ionicons
                  name={hoursExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={text}
                />
              </TouchableOpacity>

              {hoursExpanded ? (
                <View style={styles.hoursEditor}>
                  <Text style={styles.hoursEditorLabel}>Weekdays (Mon - Fri)</Text>
                  <View style={styles.hoursEditorRow}>
                    <View style={styles.hoursEditorField}>
                      <DropdownRow
                        label="Opens"
                        placeholder="Start time"
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
                        label="Closes"
                        placeholder="End time"
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
                  <Text style={styles.hoursEditorLabel}>Weekends (Sat - Sun)</Text>
                  <View style={styles.hoursEditorRow}>
                    <View style={styles.hoursEditorField}>
                      <DropdownRow
                        label="Opens"
                        placeholder="Start time"
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
                        label="Closes"
                        placeholder="End time"
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

              <View style={styles.chatToggleRow}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={text} />
                <View style={styles.chatToggleCopy}>
                  <Text style={styles.chatToggleLabel}>Buyer chat</Text>
                  <Text style={styles.chatToggleSubtext}>
                    Allow buyers to message you about pickup details
                  </Text>
                </View>
                <ToggleSwitch
                  value={buyerChatEnabled}
                  onValueChange={setBuyerChatEnabled}
                  accent={text}
                />
              </View>
              {buyerChatEnabled ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={previewChat}
                  style={styles.previewChatButton}
                >
                  <Ionicons name="chatbubble-outline" size={14} color={text} />
                  <Text style={[styles.previewChatText, { color: text }]}>Preview chat</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <View style={styles.detailBlock}>
            <DropdownRow
              label="Return policy"
              placeholder="Select return policy"
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
              options={RETURN_POLICY_OPTIONS}
              text={text}
              error={errors.returnPolicy}
            />
          </View>

          <PrimaryButton
            label="Continue"
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
  const itemTitle = isFirstItem ? 'Add My First Item' : 'Add New Item';
  const { text } = useAppTheme();
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
        `Ship items${draft.shippingFee ? ` · ${draft.shippingFee}` : ''}${draft.shippingTime ? ` · ${draft.shippingTime}` : ''
        }`,
      );
    }
    if (pickupEnabled) {
      const hours = draft.pickupHours || DEFAULT_PICKUP_HOURS;
      lines.push(
        `Local pickup${draft.pickupLocation ? ` · ${draft.pickupLocation}` : ''}`,
      );
      if (draft.pickupAddress) lines.push(draft.pickupAddress);
      lines.push(
        `Mon-Fri ${hours.weekdayStart}-${hours.weekdayEnd}, Sat-Sun ${hours.weekendStart}-${hours.weekendEnd}`,
      );
    }
    return lines;
  }, [shippingEnabled, pickupEnabled, draft]);

  const publish = async () => {
    if (isPublishing) return;

    const shippingOptions = [];
    if (shippingEnabled) shippingOptions.push('ship_items');
    if (pickupEnabled) shippingOptions.push('local_pick');

    const payload = {
      images: draft.photos || [],
      name: draft.itemName,
      category: draft.category,
      brand: draft.brand,
      condition: draft.condition,
      description: draft.description,
      price: draft.price,
      quantity: draft.quantity,
      shippingOption: shippingOptions[0] || 'ship_items',
      shippingOptions,
      estimateShippingTime: draft.shippingTime,
      shippingFee: draft.shippingFee,
      pickup: pickupEnabled
        ? {
          city: draft.pickupCity,
          location: draft.pickupLocation,
          address: draft.pickupAddress,
          hours: draft.pickupHours || DEFAULT_PICKUP_HOURS,
          buyerChatEnabled: draft.buyerChatEnabled ?? true,
        }
        : undefined,
      returnPolicy: draft.returnPolicy,
    };

    setIsPublishing(true);
    dispatch(showLoader());
    try {
      const response = await createMyClosetItem(payload);
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
        response?.message || 'Failed to publish your item.',
      );
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || 'Failed to publish your item.',
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
      subtitle="Make sure everything looks good."
    >
      {() => (
        <>
          <View style={styles.reviewHeroCard}>
            {heroPhoto ? (
              <Image
                source={{ uri: heroPhoto.uri }}
                style={styles.reviewHeroImage}
              />
            ) : null}
            <View style={styles.reviewHeroCopy}>
              <Text style={styles.reviewHeroTitle}>
                {draft.itemName || 'Vintage Leather Jacket'}
              </Text>
              {draft.brand &&
                <Text style={styles.reviewHeroText}>
                  {draft.brand}
                </Text>
              }
              <Text style={styles.reviewHeroText}>
                {getConditionLabel(draft.condition) || 'Good condition'}
              </Text>
              <Text style={styles.reviewHeroText}>
                ${draft.price || '120.00'}
              </Text>
              <Text style={styles.reviewHeroText}>
                Quantity: {draft.quantity || 1}
              </Text>
            </View>
          </View>

          <View style={styles.reviewRows}>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Category</Text>
              <Text style={styles.reviewValue}>
                {draft.category || 'Women > Jackets'}
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Description</Text>
              <Text style={styles.reviewValue}>
                {draft.description ||
                  'Classic vintage leather jacket in great condition.'}
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Delivery</Text>
              <View style={styles.reviewValueStack}>
                {deliverySummaryLines.length ? (
                  deliverySummaryLines.map((line, index) => (
                    <Text key={`${line}-${index}`} style={styles.reviewValue}>
                      {line}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.reviewValue}>Ship items</Text>
                )}
              </View>
            </View>
            {pickupEnabled ? (
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Buyer chat</Text>
                <Text style={styles.reviewValue}>
                  {(draft.buyerChatEnabled ?? true) ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
            ) : null}
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Return policy</Text>
              <Text style={styles.reviewValue}>
                {draft.returnPolicy || 'No returns'}
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Payment method</Text>
              <Text style={styles.reviewValue}>Valens Secure Checkout</Text>
            </View>
          </View>

          <PrimaryButton
            label={isPublishing ? 'Publishing...' : 'Publish Item'}
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
  const { text, bgStyle } = useAppTheme();
  const heroPhoto = draft.photos?.[0];
  const publishedName = item?.name || draft.itemName || 'Vintage Leather Jacket';
  const publishedPrice =
    item?.price ?? draft.price ?? '120.00';
  const publishedQuantity =
    item?.quantity ?? draft.quantity ?? 1;
  const shareRef = useRef(null);

  const handleShareItem = () => {
    shareRef.current?.open?.();
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
          <View style={[styles.itemLiveIcon, { borderColor: text }]}>
            <Ionicons name="bag-handle-outline" size={36} color={text} />
          </View>
        </View>

        <Text style={[styles.successTitle, { color: text }]}>Your item is live! 🎉</Text>
        <Text style={styles.successSubtitle}>
          Nice work! Your item is now visible in your closet.
        </Text>

        <View style={styles.publishedCard}>
          {heroPhoto ? (
            <Image
              source={{ uri: heroPhoto.uri }}
              style={styles.publishedThumb}
            />
          ) : null}
          <View style={styles.publishedCopy}>
            <Text style={styles.publishedTitle}>
              {publishedName}
            </Text>
            <Text style={styles.publishedSubtitle}>
              ${publishedPrice}
            </Text>
            <Text style={styles.publishedSubtitle}>
              Quantity: {publishedQuantity}
            </Text>
            <Text style={styles.publishedSubtitle}>
              {getConditionLabel(draft.condition) || 'Good condition'}
            </Text>
          </View>
        </View>

        <View style={styles.nextActions}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleShareItem}
            style={styles.nextActionCard}
          >
            <Ionicons name="share-social-outline" size={18} color={text} />
            <Text style={styles.nextActionText}>Share your item</Text>
          </TouchableOpacity>

          {/* <View style={styles.nextActionCard}>
            <Ionicons name="bag-outline" size={18} color={text} />
            <Text style={styles.nextActionText}>Manage my closet</Text>
          </View> */}
        </View>

        <View style={styles.successActions}>
          <SecondaryButton
            label="Go to My Closet"
            text={text}
            onPress={() =>
              navigation.navigate('Profile', { initialTab: 'closet' })
            }
          />
          <PrimaryButton
            label="Add Another Item"
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
  },
  stepCircleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
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
    color: '#111827',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
  card: {
    borderRadius: 26,
    borderWidth: 1,
    backgroundColor: '#fff',
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
    color: '#3f3f46',
  },
  fieldWrap: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  placeFieldSearchInline: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
    marginRight: 6,
  },
  placeFieldPredictionsBox: {
    marginTop: 4,
    marginLeft: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  placeFieldNoResults: {
    fontSize: 12,
    color: '#9ca3af',
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
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  placeFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginRight: 8,
  },
  placeFieldValueBox: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: '#fff',
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
    color: '#111827',
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
    color: '#71717a',
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  dropdownRow: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#fff',
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
    color: '#111827',
    flex: 1,
    marginRight: 10,
  },
  dropdownList: {
    maxHeight: 150,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#e5e7eb',
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
    backgroundColor: '#fff',
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownItemSelected: {
    backgroundColor: '#f5f3ff',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#111827',
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
    color: '#374151',
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
    backgroundColor: '#fff',
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
    color: '#6b7280',
    marginBottom: 12,
  },
  helperText: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginVertical: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
    color: '#3f3f46',
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
    backgroundColor: '#fff',
    padding: 12,
    justifyContent: 'space-between',
  },
  optionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f3ff',
    marginBottom: 8,
  },
  optionCopy: {
    flex: 1,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: '#6b7280',
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
    color: '#111827',
  },
  sectionHeaderBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#f5f3ff',
  },
  sectionHeaderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5A2386',
  },
  helperLineTop: {
    fontSize: 12,
    color: '#6b7280',
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
    backgroundColor: '#fff',
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
    color: '#111827',
    marginBottom: 2,
  },
  deliveryDescription: {
    fontSize: 11,
    color: '#6b7280',
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
    color: '#6b7280',
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
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
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
    color: '#3f3f46',
    marginBottom: 3,
  },
  hoursValue: {
    fontSize: 12,
    color: '#6b7280',
  },
  hoursEditor: {
    marginTop: -6,
    marginBottom: 14,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafafa',
  },
  hoursEditorLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3f3f46',
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
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
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
    color: '#111827',
    marginBottom: 2,
  },
  chatToggleSubtext: {
    fontSize: 11,
    color: '#6b7280',
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
    backgroundColor: '#fff',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  paymentIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
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
    color: '#111827',
    marginBottom: 3,
  },
  paymentSubtitle: {
    fontSize: 12,
    color: '#6b7280',
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
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  linkCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#fff',
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
    color: '#6b7280',
    marginBottom: 4,
  },
  linkValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f3ff',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  photoHeroLabel: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  photoHeroSubLabel: {
    fontSize: 13,
    color: '#6b7280',
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
    color: '#374151',
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
    color: '#3f3f46',
  },
  selectedPhotosCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
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
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  addMoreMiniText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
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
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: '#fff',
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
    color: '#111827',
  },
  helperLine: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
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
    color: '#111827',
    marginBottom: 4,
  },
  feeText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6b7280',
  },
  reviewHeroCard: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#fff',
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
    color: '#111827',
    marginBottom: 4,
  },
  reviewHeroText: {
    fontSize: 12,
    color: '#4b5563',
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
    color: '#6b7280',
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
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  publishedCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    color: '#111827',
    marginBottom: 4,
  },
  publishedSubtitle: {
    fontSize: 12,
    color: '#4b5563',
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
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  nextActionText: {
    marginLeft: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
});