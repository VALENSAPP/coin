import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getPlaceDetails, isGooglePlacesConfigured, searchPlacePredictions, searchCityPredictions } from '../../services/googlePlaces';
import {
  PICKUP_CITY_OPTIONS,
  PICKUP_LOCATIONS_BY_CITY,
  PICKUP_TIME_OPTIONS,
  DEFAULT_PICKUP_HOURS,
  AdvancedDropdownRow,
  PlaceFieldRow,
  ToggleSwitch
} from './MyClosetPickupComponents';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n';
import {
  deleteMyClosetItem,
  getMyClosetItems,
  updateMyClosetItem,
} from '../../services/myCloset';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { formSurfaces, withAlpha } from '../../utils/closetTheme';
// NOTE: `value` stays a fixed English identifier — only `label` is translated —
// so the payload sent to the API never changes with locale.
const getConditionOptions = t => [
  { label: t('myClosetItems.conditionNew'), value: 'New' },
  { label: t('myClosetItems.conditionUsed'), value: 'Used' },
  { label: t('myClosetItems.conditionGood'), value: 'Good_condition' },
  { label: t('myClosetItems.conditionNeedsAttention'), value: 'Need_attention' },
];

const getShippingOptions = t => [
  { label: t('myClosetItems.shippingShip'), value: 'ship_items' },
  { label: t('myClosetItems.shippingLocalPickup'), value: 'local_pick' },
];

const getReturnPolicyOptions = t => [
  { label: t('myClosetItems.returnPolicyNone'), value: 'No returns' },
  { label: t('myClosetItems.returnPolicy7Day'), value: '7-day returns' },
  { label: t('myClosetItems.returnPolicy14Day'), value: '14-day returns' },
  { label: t('myClosetItems.returnPolicyExchangeOnly'), value: 'Exchange only' },
];

const getCategoryOptions = t => [
  { label: t('myClosetItems.categoryWomenJackets'), value: 'Women > Jackets' },
  { label: t('myClosetItems.categoryWomenDresses'), value: 'Women > Dresses' },
  { label: t('myClosetItems.categoryMenShirts'), value: 'Men > Shirts' },
  { label: t('myClosetItems.categoryAccessoriesBags'), value: 'Accessories > Bags' },
  { label: t('myClosetItems.categoryShoesSneakers'), value: 'Shoes > Sneakers' },
  { label: t('myClosetItems.categoryHomeDecor'), value: 'Home > Decor' },
  { label: t('myClosetItems.categoryVintagePieces'), value: 'Vintage > Pieces' },
  { label: t('myClosetItems.categoryOthers'), value: 'Others' },
];

const getBuyerChatOptions = t => [
  { label: t('myClosetItems.yes') || 'Yes', value: 'true' },
  { label: t('myClosetItems.no') || 'No', value: 'false' },
];

const getOptionLabel = option =>
  typeof option === 'string' ? option : option?.label || option?.value || '';

const getOptionValue = option =>
  typeof option === 'string' ? option : option?.value || '';

const getConditionLabel = (value, t) => {
  switch (String(value || '').trim()) {
    case 'New':
      return t('myClosetItems.conditionNew');
    case 'Used':
      return t('myClosetItems.conditionUsed');
    case 'Good_condition':
      return t('myClosetItems.conditionGood');
    case 'Need_attention':
      return t('myClosetItems.conditionNeedsAttention');
    default:
      return value || '';
  }
};

const getShippingLabel = (value, t) => {
  switch (String(value || '').trim()) {
    case 'ship_items':
      return t('myClosetItems.shippingShip');
    case 'local_pick':
      return t('myClosetItems.shippingLocalPickup');
    default:
      return value || '';
  }
};

const formatPrice = value => {
  if (value == null || value === '') return '$0.00';
  const textValue = String(value).trim();
  if (textValue.startsWith('$')) return textValue;
  const numericValue = Number(textValue);
  if (Number.isNaN(numericValue)) return textValue;
  return `$${numericValue.toFixed(2)}`;
};

const parseFee = feeLabel => {
  const match = String(feeLabel || '').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
};

const extractItemImage = item => item?.images?.[0] || item?.image || item?.thumbnail || null;

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  accent,
}) => {
  const { isDarkMode } = useThemeContext();
  const { textStyle } = useAppTheme();
  const surfaces = formSurfaces(isDarkMode);

  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: surfaces.labelColor }]}>{label}</Text>
      <View style={[styles.fieldWrap, { backgroundColor: surfaces.inputSurface, borderColor: withAlpha(accent, isDarkMode ? 0.35 : 0.16) }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={surfaces.placeholderColor}
          multiline={multiline}
          keyboardType={keyboardType}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[styles.fieldInput, textStyle, multiline && styles.fieldInputMultiline]}
        />
      </View>
    </View>
  );
};

const DropdownRow = ({ label, value, options, onSelect, placeholder, accent }) => {
  const [expanded, setExpanded] = useState(false);
  const { isDarkMode } = useThemeContext();
  const { textStyle } = useAppTheme();
  const surfaces = formSurfaces(isDarkMode);
  const selectedOption = options.find(option => getOptionValue(option) === value);
  const displayValue = selectedOption ? getOptionLabel(selectedOption) : value;

  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: surfaces.labelColor }]}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setExpanded(prev => !prev)}
        style={[styles.dropdownRow, { backgroundColor: surfaces.inputSurface, borderColor: withAlpha(accent, isDarkMode ? 0.35 : 0.16) }]}
      >
        <Text style={[styles.dropdownValue, textStyle, !value && { color: surfaces.placeholderColor }]}>
          {displayValue || placeholder}
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={accent} />
      </TouchableOpacity>
      {expanded ? (
        <View style={[styles.dropdownList, { backgroundColor: surfaces.listSurface, borderColor: surfaces.listBorder }]}>
          {options.map((option, index) => {
            const optionValue = getOptionValue(option);
            const optionLabel = getOptionLabel(option);
            const selected = value === optionValue;
            return (
              <TouchableOpacity
                key={optionValue || optionLabel || index}
                activeOpacity={0.8}
                onPress={() => {
                  onSelect(optionValue);
                  setExpanded(false);
                }}
                style={[
                  styles.dropdownItem,
                  { backgroundColor: selected ? withAlpha(accent, isDarkMode ? 0.22 : 0.12) : surfaces.listSurface },
                  index !== options.length - 1 && [styles.dropdownItemBorder, { borderBottomColor: surfaces.itemBorder }],
                ]}
              >
                <Text style={[styles.dropdownItemText, textStyle, selected && { color: accent, fontWeight: '800' }]}>
                  {optionLabel}
                </Text>
                {selected ? <Ionicons name="checkmark" size={16} color={accent} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const parsePickupHours = str => {
  if (!str || typeof str !== 'string') return DEFAULT_PICKUP_HOURS;
  const match = str.match(/Mon-Fri\s+(.*)-(.*),\s*Sat-Sun\s+(.*)-(.*)/);
  if (match) {
    return {
      weekdayStart: match[1].trim(),
      weekdayEnd: match[2].trim(),
      weekendStart: match[3].trim(),
      weekendEnd: match[4].trim(),
    };
  }
  return DEFAULT_PICKUP_HOURS;
};

const formatPickupHours = hours => {
  const h = hours || DEFAULT_PICKUP_HOURS;
  return `Mon-Fri ${h.weekdayStart}-${h.weekdayEnd}, Sat-Sun ${h.weekendStart}-${h.weekendEnd}`;
};

const toEditableItem = item => {
  let derivedCity = item?.pickupCity || '';
  if (!derivedCity && item?.pickupAddress) {
    const foundCity = PICKUP_CITY_OPTIONS.find(city => item.pickupAddress.includes(city));
    if (foundCity) derivedCity = foundCity;
  }

  return {
    id: item?.id || item?._id,
    name: item?.name || item?.title || item?.itemName || '',
    category: item?.category || '',
    brand: item?.brand || '',
    condition: item?.condition || '',
    description: item?.description || '',
    price: String(item?.price ?? item?.amount ?? item?.salePrice ?? ''),
    quantity: String(item?.quantity ?? 1),
    shippingOption: item?.shippingOption || item?.shippingOptions || '',
    shippingTime: item?.estimateShippingTime || item?.shippingTime || '',
    shippingFee: String(item?.shippingFee ?? ''),
    pickupCity: derivedCity,
    pickupLocation: item?.pickupLocation || '',
    pickupAddress: item?.pickupAddress || '',
    pickupHours: parsePickupHours(item?.pickupAvailableHours || item?.pickupHours),
    buyerChatEnabled: String(item?.buyerChatEnabled) !== 'false',
    returnPolicy: item?.returnPolicy || '',
    image: extractItemImage(item),
  };
};

const buildPayload = draft => {
  const shippingOption = draft.shippingOption || 'ship_items';
  const shippingEnabled = shippingOption !== 'local_pick';
  const pickupEnabled = shippingOption === 'local_pick' || shippingOption === 'both';

  const payload = new FormData();

  payload.append('name', String(draft.name || '').trim());
  payload.append('category', String(draft.category || '').trim());
  if (draft.brand) payload.append('brand', String(draft.brand).trim());
  payload.append('condition', String(draft.condition || '').trim());
  payload.append('description', String(draft.description || '').trim());
  payload.append('price', String(draft.price ?? ''));
  payload.append('quantity', String(draft.quantity ?? 1));
  payload.append('shippingOption', shippingOption);

  if (shippingEnabled) {
    payload.append('shippingFee', String(parseFee(draft.shippingFee)));
    if (draft.shippingTime) payload.append('estimateShippingTime', draft.shippingTime);
  }

  if (pickupEnabled) {
    if (draft.pickupCity) payload.append('pickupCity', String(draft.pickupCity).trim());
    if (draft.pickupLocation) payload.append('pickupLocation', String(draft.pickupLocation).trim());
    payload.append('pickupAddress', String(draft.pickupAddress || '').trim());
    payload.append('pickupAvailableHours', formatPickupHours(draft.pickupHours));
    payload.append('buyerChatEnabled', String(draft.buyerChatEnabled ?? true));
  }

  payload.append('returnPolicy', String(draft.returnPolicy || '').trim());

  return payload;
};

const ClosestHeader = ({ title, subtitle, onBack, accent, textStyle, mutedTextStyle }) => {
  const { isDarkMode } = useThemeContext();
  const chipSurface = isDarkMode ? 'rgba(255,255,255,0.08)' : '#ffffff';

  return (
    <View style={styles.headerRow}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onBack}
        style={[styles.backButton, { backgroundColor: chipSurface }]}
      >
        <Ionicons name="chevron-back" size={22} color={accent} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <Text style={[styles.headerTitle, textStyle]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.headerSubtitle, mutedTextStyle]}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
};

const MyClosetItemsManagementScreen = ({ navigation, route }) => {
  const { accent, bgStyle, cardStyle, textStyle, mutedTextStyle, border, card } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const { t } = useLanguage();
  const toast = useToast();
  const dispatch = useDispatch();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const section = route?.params?.section || 'items';
  const returnTo = route?.params?.returnTo;

  const handleBack = useCallback(() => {
    if (returnTo === 'MyClosetDashboard') {
      navigation.navigate('MainApp', {
        screen: 'wallet',
        params: { screen: 'MyCloset' },
      });
      return;
    }
    navigation.goBack();
  }, [navigation, returnTo]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    dispatch(showLoader());
    try {
      const response = await getMyClosetItems();
      const payload =
        response?.data?.data ??
        response?.data?.items ??
        response?.data ??
        response;
      const nextItems = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
      setItems(nextItems);
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || t('myClosetItems.loadError'),
      );
      setItems([]);
    } finally {
      setLoading(false);
      dispatch(hideLoader());
    }
  }, [dispatch, toast, t]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems]),
  );

  const handleDelete = useCallback(
    item => {
      Alert.alert(
        t('myClosetItems.deleteConfirmTitle'),
        t('myClosetItems.deleteConfirmMessage'),
        [
          { text: t('myClosetItems.cancel'), style: 'cancel' },
          {
            text: t('myClosetItems.delete'),
            style: 'destructive',
            onPress: async () => {
              dispatch(showLoader());
              try {
                const response = await deleteMyClosetItem(item.id || item._id);
                const deleted =
                  response?.statusCode === 200 ||
                  response?.statusCode === 204 ||
                  response === '' ||
                  response == null;
                if (deleted) {
                  showToastMessage(toast, 'success', t('myClosetItems.deleteSuccess'));
                  await loadItems();
                  return;
                }

                showToastMessage(
                  toast,
                  'danger',
                  response?.message || t('myClosetItems.deleteError'),
                );
              } catch (error) {
                showToastMessage(
                  toast,
                  'danger',
                  error?.response?.data?.message || error?.message || t('myClosetItems.deleteError'),
                );
              } finally {
                dispatch(hideLoader());
              }
            },
          },
        ],
      );
    },
    [dispatch, loadItems, toast, t],
  );

  const subtitle =
    section === 'orders'
      ? t('myClosetItems.subtitleOrders')
      : t('myClosetItems.subtitleItems');

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <ClosestHeader
          title={section === 'orders' ? t('myClosetItems.headerTitleOrders') : t('myClosetItems.headerTitleItems')}
          subtitle={subtitle}
          onBack={handleBack}
          accent={accent}
          textStyle={textStyle}
          mutedTextStyle={mutedTextStyle}
        />

        {loading ? (
          <>
          </>
        ) : items.length ? (
          items.map(item => {
            const normalized = toEditableItem(item);
            return (
              <View key={normalized.id} style={[styles.itemCard, cardStyle, { borderColor: withAlpha(accent, 0.16) }]}>
                <View style={styles.itemRowTop}>
                  <View style={[styles.itemThumb, { backgroundColor: withAlpha(accent, 0.1) }]}>
                    {normalized.image ? (
                      <Image source={{ uri: normalized.image }} style={styles.itemThumbImage} />
                    ) : (
                      <Ionicons name="shirt-outline" size={24} color={accent} />
                    )}
                  </View>
                  <View style={styles.itemCopy}>
                    <Text style={[styles.itemTitle, textStyle]} numberOfLines={1}>
                      {normalized.name}
                    </Text>
                    <Text style={[styles.itemMeta, mutedTextStyle]}>{formatPrice(normalized.price)}</Text>
                    <Text style={[styles.itemMeta, mutedTextStyle]}>{getConditionLabel(normalized.condition, t)}</Text>
                  </View>
                </View>
                <View style={styles.itemButtonRow}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.navigate('ProfileMain', {
                        screen: 'MyClosetItemEditor',
                        params: { item: normalized },
                      })
                    }
                    style={[styles.actionButton, { borderColor: withAlpha(accent, 0.35), backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : card }]}
                  >
                    <Text style={[styles.actionButtonText, { color: accent }]}>{t('myClosetItems.edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleDelete(normalized)}
                    style={[styles.deleteButton, { borderColor: '#fecaca' }]}
                  >
                    <Text style={styles.deleteButtonText}>{t('myClosetItems.delete')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        ) : (
          <View style={[styles.emptyCard, cardStyle, { borderColor: withAlpha(accent, 0.2) }]}>
            <Ionicons name="shirt-outline" size={28} color={accent} />
            <Text style={[styles.emptyTitle, textStyle]}>{t('myClosetItems.emptyTitle')}</Text>
            <Text style={[styles.emptyText, mutedTextStyle]}>{t('myClosetItems.emptyText')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const MyClosetItemEditorScreen = ({ navigation, route }) => {
  const { accent, bgStyle, cardStyle, textStyle, mutedTextStyle, border, card, text } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const { t } = useLanguage();
  const toast = useToast();
  const dispatch = useDispatch();
  const item = route?.params?.item || {};
  const returnTo = route?.params?.returnTo;
  const [draft, setDraft] = useState(() => toEditableItem(item));
  const [saving, setSaving] = useState(false);

  const CONDITION_OPTIONS = useMemo(() => getConditionOptions(t), [t]);
  const SHIPPING_OPTIONS = useMemo(() => getShippingOptions(t), [t]);
  const RETURN_POLICY_OPTIONS = useMemo(() => getReturnPolicyOptions(t), [t]);
  const CATEGORY_OPTIONS = useMemo(() => getCategoryOptions(t), [t]);
  const BUYER_CHAT_OPTIONS = useMemo(() => getBuyerChatOptions(t), [t]);

  const hasPlacesApi = useMemo(() => isGooglePlacesConfigured(), []);

  const [cityQuery, setCityQuery] = useState(draft.pickupCity || '');
  const [cityPredictions, setCityPredictions] = useState([]);
  const [citySearching, setCitySearching] = useState(false);
  const cityDebounceRef = React.useRef(null);

  const [pickupQuery, setPickupQuery] = useState(
    draft.pickupLocation ? `${draft.pickupLocation}${draft.pickupAddress ? `, ${draft.pickupAddress}` : ''}` : ''
  );
  const [pickupPredictions, setPickupPredictions] = useState([]);
  const [pickupSearching, setPickupSearching] = useState(false);
  const pickupDebounceRef = React.useRef(null);

  const [pickupCoords, setPickupCoords] = useState(null);
  const [expandedField, setExpandedField] = useState(null);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setDraft(toEditableItem(item));
  }, [item]);

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
    try {
      const details = await getPlaceDetails(prediction.id);
      const cityLabel = details.city || prediction.description;
      setDraft(prev => ({ ...prev, pickupCity: cityLabel, pickupLocation: '', pickupAddress: '' }));
      setCityQuery(cityLabel);
      if (details.latitude != null && details.longitude != null) {
        setPickupCoords({ latitude: details.latitude, longitude: details.longitude });
      }
      setPickupQuery('');
      if (errors.pickupCity) setErrors(prev => ({ ...prev, pickupCity: null }));
    } catch {
      setDraft(prev => ({ ...prev, pickupCity: prediction.description }));
      setCityQuery(prediction.description);
    }
  };

  const handleSelectCityFallback = value => {
    setDraft(prev => ({ ...prev, pickupCity: value, pickupLocation: '', pickupAddress: '' }));
    setCityQuery(value);
    setPickupQuery('');
    setExpandedField(null);
    if (errors.pickupCity) setErrors(prev => ({ ...prev, pickupCity: null }));
  };

  useEffect(() => {
    if (!hasPlacesApi || expandedField !== 'pickupLocation' || !draft.pickupCity) return undefined;
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
  }, [pickupQuery, hasPlacesApi, expandedField, draft.pickupCity, pickupCoords]);

  const handleSelectPickupPrediction = async prediction => {
    setPickupQuery(prediction.description);
    setPickupPredictions([]);
    setExpandedField(null);
    try {
      const details = await getPlaceDetails(prediction.id);
      const fallbackLabel = prediction.description.split(',')[0];
      const loc = details.name || fallbackLabel;
      const addr = details.formattedAddress || prediction.description;
      setDraft(prev => ({ ...prev, pickupLocation: loc, pickupAddress: addr }));
      setPickupQuery(loc);
      if (errors.pickupLocation) setErrors(prev => ({ ...prev, pickupLocation: null }));
    } catch {
      setDraft(prev => ({
        ...prev,
        pickupLocation: prediction.description.split(',')[0],
        pickupAddress: prediction.description
      }));
    }
  };

  const handleSelectPickupLocationFallback = value => {
    const match = (PICKUP_LOCATIONS_BY_CITY[draft.pickupCity] || []).find(
      p => p.label === value || p.address === value,
    );
    setDraft(prev => ({ ...prev, pickupLocation: value, pickupAddress: match?.address || '' }));
    setPickupQuery(value);
    setExpandedField(null);
    if (errors.pickupLocation) setErrors(prev => ({ ...prev, pickupLocation: null }));
  };

  const openInMaps = () => {
    if (!draft.pickupAddress) return;
    const query = encodeURIComponent(draft.pickupAddress);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() => {});
  };

  const pickupLocationOptions = useMemo(
    () => (PICKUP_LOCATIONS_BY_CITY[draft.pickupCity] || []).map(place => place.label),
    [draft.pickupCity],
  );

  const handleBack = useCallback(() => {
    if (returnTo === 'MyClosetDashboard') {
      navigation.navigate('MainApp', {
        screen: 'wallet',
        params: { screen: 'MyCloset' },
      });
      return;
    }

    navigation.goBack();
  }, [navigation, returnTo]);

  const handleSave = useCallback(async () => {
    if (!draft.id) return;
    setSaving(true);
    dispatch(showLoader());
    try {
      const response = await updateMyClosetItem(draft.id, buildPayload(draft));
      if (response?.statusCode === 200 || response?.statusCode === 201) {
        showToastMessage(toast, 'success', response?.message || t('myClosetItemEditor.updateSuccess'));
        handleBack();
        return;
      }

      showToastMessage(
        toast,
        'danger',
        response?.message || t('myClosetItemEditor.updateError'),
      );
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || t('myClosetItemEditor.updateError'),
      );
    } finally {
      setSaving(false);
      dispatch(hideLoader());
    }
  }, [draft, dispatch, handleBack, navigation, toast, t]);

  const handleDelete = useCallback(() => {
    if (!draft.id) return;
    Alert.alert(t('myClosetItemEditor.deleteConfirmTitle'), t('myClosetItemEditor.deleteConfirmMessage'), [
      { text: t('myClosetItems.cancel'), style: 'cancel' },
      {
        text: t('myClosetItems.delete'),
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          dispatch(showLoader());
          try {
            const response = await deleteMyClosetItem(draft.id);
            const deleted =
              response?.statusCode === 200 ||
              response?.statusCode === 204 ||
              response === '' ||
              response == null;
            if (deleted) {
              showToastMessage(toast, 'success', t('myClosetItemEditor.deleteSuccess'));
              handleBack();
              return;
            }

            showToastMessage(
              toast,
              'danger',
              response?.message || t('myClosetItemEditor.deleteError'),
            );
          } catch (error) {
            showToastMessage(
              toast,
              'danger',
              error?.response?.data?.message || error?.message || t('myClosetItemEditor.deleteError'),
            );
          } finally {
            setSaving(false);
            dispatch(hideLoader());
          }
        },
      },
    ]);
  }, [draft.id, dispatch, handleBack, navigation, toast, t]);

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        enableAutomaticScroll
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled"
      >
        <ClosestHeader
          title={t('myClosetItemEditor.headerTitle')}
          onBack={handleBack}
          accent={accent}
          textStyle={textStyle}
          mutedTextStyle={mutedTextStyle}
        />

        <View style={[styles.formCard, cardStyle, { borderColor: withAlpha(accent, 0.16) }]}>
          <Field
            label={t('myClosetItemEditor.itemNameLabel')}
            value={draft.name}
            onChangeText={value => setDraft(prev => ({ ...prev, name: value }))}
            placeholder={t('myClosetItemEditor.itemNamePlaceholder')}
          accent={accent}
          />
          <DropdownRow
            label={t('myClosetItemEditor.categoryLabel')}
            value={draft.category}
            options={CATEGORY_OPTIONS}
            placeholder={t('myClosetItemEditor.categoryPlaceholder')}
            onSelect={value => setDraft(prev => ({ ...prev, category: value }))}
          accent={accent}
          />
          <Field
            label={t('myClosetItemEditor.brandLabel')}
            value={draft.brand}
            onChangeText={value => setDraft(prev => ({ ...prev, brand: value }))}
            placeholder={t('myClosetItemEditor.brandPlaceholder')}
          accent={accent}
          />
          <DropdownRow
            label={t('myClosetItemEditor.conditionLabel')}
            value={draft.condition}
            options={CONDITION_OPTIONS}
            placeholder={t('myClosetItemEditor.conditionPlaceholder')}
            onSelect={value => setDraft(prev => ({ ...prev, condition: value }))}
          accent={accent}
          />
          <Field
            label={t('myClosetItemEditor.descriptionLabel')}
            value={draft.description}
            onChangeText={value => setDraft(prev => ({ ...prev, description: value }))}
            placeholder={t('myClosetItemEditor.descriptionPlaceholder')}
            multiline
          accent={accent}
          />
          <Field
            label={t('myClosetItemEditor.priceLabel')}
            value={draft.price}
            onChangeText={value => setDraft(prev => ({ ...prev, price: value }))}
            placeholder={t('myClosetItemEditor.pricePlaceholder')}
            keyboardType="numeric"
          accent={accent}
          />
          <Field
            label={t('myClosetItemEditor.quantityLabel')}
            value={draft.quantity}
            onChangeText={value => setDraft(prev => ({ ...prev, quantity: value }))}
            placeholder={t('myClosetItemEditor.quantityPlaceholder')}
            keyboardType="numeric"
          accent={accent}
          />
          <DropdownRow
            label={t('myClosetItemEditor.shippingOptionLabel')}
            value={draft.shippingOption}
            options={SHIPPING_OPTIONS}
            placeholder={t('myClosetItemEditor.shippingOptionPlaceholder')}
            onSelect={value => setDraft(prev => ({ ...prev, shippingOption: value }))}
          accent={accent}
          />
          <Field
            label={t('myClosetItemEditor.shippingFeeLabel')}
            value={draft.shippingFee}
            onChangeText={value => setDraft(prev => ({ ...prev, shippingFee: value }))}
            placeholder={t('myClosetItemEditor.shippingFeePlaceholder')}
            keyboardType="numeric"
          />
          <Field
            label={t('myClosetItemEditor.shippingTimeLabel')}
            value={draft.shippingTime}
            onChangeText={value => setDraft(prev => ({ ...prev, shippingTime: value }))}
            placeholder={t('myClosetItemEditor.shippingTimePlaceholder')}
          accent={accent}
          />
          {/* Pickup City */}
          {hasPlacesApi ? (
            <PlaceFieldRow
              icon="location-outline"
              label={t('myClosetAddItemShipping.pickupCity') || 'Pickup City'}
              placeholder={t('myClosetAddItemShipping.searchCity') || 'Search city...'}
              value={draft.pickupCity}
              filled={Boolean(draft.pickupCity)}
              expanded={expandedField === 'pickupCity'}
              onToggle={() => {
                setCityQuery(draft.pickupCity || '');
                setExpandedField('pickupCity');
              }}
              onCollapse={() => setExpandedField(null)}
              query={cityQuery}
              onQueryChange={setCityQuery}
              predictions={cityPredictions}
              searching={citySearching}
              onSelectPrediction={handleSelectCityPrediction}
              text={text}
              error={errors.pickupCity}
              t={t}
            />
          ) : (
            <AdvancedDropdownRow
              label={t('myClosetAddItemShipping.pickupCity') || 'Pickup City'}
              placeholder={t('myClosetAddItemShipping.selectCity') || 'Select city'}
              value={draft.pickupCity}
              expanded={expandedField === 'pickupCity'}
              onToggle={() => setExpandedField(prev => (prev === 'pickupCity' ? null : 'pickupCity'))}
              onSelect={handleSelectCityFallback}
              options={PICKUP_CITY_OPTIONS}
              text={text}
              error={errors.pickupCity}
            />
          )}

          {/* Pickup Location */}
          {hasPlacesApi ? (
            <PlaceFieldRow
              icon="business-outline"
              label={t('myClosetAddItemShipping.pickupSpot') || 'Pickup Spot'}
              placeholder={draft.pickupCity ? (t('myClosetAddItemShipping.selectPickupSpot') || 'Search area or address...') : (t('myClosetAddItemShipping.selectCityFirst') || 'Select a city first')}
              value={draft.pickupLocation}
              filled={Boolean(draft.pickupLocation)}
              disabled={!draft.pickupCity}
              expanded={expandedField === 'pickupLocation'}
              onToggle={() => {
                if (!draft.pickupCity) return;
                setPickupQuery(draft.pickupLocation || '');
                setExpandedField('pickupLocation');
              }}
              onCollapse={() => setExpandedField(null)}
              query={pickupQuery}
              onQueryChange={setPickupQuery}
              predictions={pickupPredictions}
              searching={pickupSearching}
              onSelectPrediction={handleSelectPickupPrediction}
              text={text}
              error={errors.pickupLocation}
              t={t}
            />
          ) : (
            <AdvancedDropdownRow
              label={t('myClosetAddItemShipping.pickupSpot') || 'Pickup Spot'}
              placeholder={draft.pickupCity ? (t('myClosetAddItemShipping.selectPickupSpot') || 'Select spot') : (t('myClosetAddItemShipping.selectCityFirst') || 'Select a city first')}
              value={draft.pickupLocation}
              expanded={expandedField === 'pickupLocation'}
              onToggle={() => {
                if (!draft.pickupCity) return;
                setExpandedField(prev => (prev === 'pickupLocation' ? null : 'pickupLocation'));
              }}
              onSelect={handleSelectPickupLocationFallback}
              options={pickupLocationOptions}
              text={text}
              error={errors.pickupLocation}
            />
          )}

          {draft.pickupAddress ? (
            <View style={{ marginLeft: 44, marginTop: -4, marginBottom: 14 }}>
              <Text style={[styles.pickupAddressText, mutedTextStyle]}>
                {draft.pickupAddress}
              </Text>
              <TouchableOpacity activeOpacity={0.8} onPress={openInMaps} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="map-outline" size={14} color={accent} />
                <Text style={{ marginLeft: 5, fontSize: 12, fontWeight: '700', color: accent, textDecorationLine: 'underline' }}>
                  {t('myClosetAddItemShipping.viewOnMap') || 'View on Map'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Pickup Hours */}
          <View style={{ marginBottom: 16 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setHoursExpanded(prev => !prev)}
              style={{
                minHeight: 58,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: surfaces.listBorder,
                backgroundColor: surfaces.inputSurface,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 10,
                marginBottom: 14,
              }}
            >
              <View style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: surfaces.iconBubble,
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Ionicons name="time-outline" size={17} color={accent} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: surfaces.labelColor, marginBottom: 3 }}>
                  {t('myClosetAddItemShipping.availableHours') || 'Available Hours'}
                </Text>
                <Text style={{ fontSize: 12, color: surfaces.mutedColor }}>
                  {draft.pickupHours?.weekdayStart} - {draft.pickupHours?.weekdayEnd}
                </Text>
              </View>
              <Ionicons name={hoursExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={textStyle?.color || accent} />
            </TouchableOpacity>
            {hoursExpanded ? (
              <View style={{ marginTop: -6, marginBottom: 14, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: surfaces.listBorder, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#fafafa' }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: surfaces.labelColor, marginBottom: 8 }}>
                  {t('myClosetAddItemShipping.weekdays') || 'Weekdays (Mon-Fri)'}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                  <View style={{ flex: 1 }}>
                    <AdvancedDropdownRow
                      placeholder="Start"
                      value={draft.pickupHours?.weekdayStart}
                      expanded={expandedField === 'weekdayStart'}
                      onToggle={() => setExpandedField(prev => (prev === 'weekdayStart' ? null : 'weekdayStart'))}
                      onSelect={val => setDraft(prev => ({ ...prev, pickupHours: { ...prev.pickupHours, weekdayStart: val } }))}
                      options={PICKUP_TIME_OPTIONS}
                      text={text}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AdvancedDropdownRow
                      placeholder="End"
                      value={draft.pickupHours?.weekdayEnd}
                      expanded={expandedField === 'weekdayEnd'}
                      onToggle={() => setExpandedField(prev => (prev === 'weekdayEnd' ? null : 'weekdayEnd'))}
                      onSelect={val => setDraft(prev => ({ ...prev, pickupHours: { ...prev.pickupHours, weekdayEnd: val } }))}
                      options={PICKUP_TIME_OPTIONS}
                      text={text}
                    />
                  </View>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '800', color: surfaces.labelColor, marginBottom: 8, marginTop: 4 }}>
                  {t('myClosetAddItemShipping.weekends') || 'Weekends (Sat-Sun)'}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <AdvancedDropdownRow
                      placeholder="Start"
                      value={draft.pickupHours?.weekendStart}
                      expanded={expandedField === 'weekendStart'}
                      onToggle={() => setExpandedField(prev => (prev === 'weekendStart' ? null : 'weekendStart'))}
                      onSelect={val => setDraft(prev => ({ ...prev, pickupHours: { ...prev.pickupHours, weekendStart: val } }))}
                      options={PICKUP_TIME_OPTIONS}
                      text={text}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AdvancedDropdownRow
                      placeholder="End"
                      value={draft.pickupHours?.weekendEnd}
                      expanded={expandedField === 'weekendEnd'}
                      onToggle={() => setExpandedField(prev => (prev === 'weekendEnd' ? null : 'weekendEnd'))}
                      onSelect={val => setDraft(prev => ({ ...prev, pickupHours: { ...prev.pickupHours, weekendEnd: val } }))}
                      options={PICKUP_TIME_OPTIONS}
                      text={text}
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </View>

          {/* Chat Toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: surfaces.listBorder, backgroundColor: surfaces.inputSurface, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isDarkMode ? 'rgba(13,148,136,0.2)' : '#f0fdfa', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chatbubbles-outline" size={17} color="#0d9488" />
            </View>
            <View style={{ flex: 1, marginLeft: 10, marginRight: 10 }}>
              <Text style={[textStyle, { fontSize: 13, fontWeight: '800', marginBottom: 2 }]}>
                {t('myClosetAddItemShipping.enableBuyerChat') || 'Enable Buyer Chat'}
              </Text>
              <Text style={[mutedTextStyle, { fontSize: 11, lineHeight: 15 }]}>
                {t('myClosetAddItemShipping.enableBuyerChatDesc') || 'Allow buyers to message you before purchase.'}
              </Text>
            </View>
            <ToggleSwitch
              value={draft.buyerChatEnabled}
              onValueChange={val => setDraft(prev => ({ ...prev, buyerChatEnabled: val }))}
              accent="#0d9488"
            />
          </View>
          <DropdownRow
            label={t('myClosetItemEditor.returnPolicyLabel')}
            value={draft.returnPolicy}
            options={RETURN_POLICY_OPTIONS}
            placeholder={t('myClosetItemEditor.returnPolicyPlaceholder')}
            onSelect={value => setDraft(prev => ({ ...prev, returnPolicy: value }))}
          accent={accent}
          />
        </View>

        <View style={styles.actionStack}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSave}
            disabled={saving}
            style={[styles.primaryButton, { backgroundColor: accent, opacity: saving ? 0.8 : 1 }]}
          >
            <Text style={styles.primaryButtonText}>{t('myClosetItemEditor.updateButton')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleDelete}
            disabled={saving}
            style={styles.deleteButtonLarge}
          >
            <Text style={styles.deleteButtonLargeText}>{t('myClosetItemEditor.deleteButton')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

export {
  MyClosetItemsManagementScreen,
  MyClosetItemEditorScreen,
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screenContent: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 12,
  },
  headerSpacer: {
    width: 42,
  },
  loadingWrap: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  itemRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemThumb: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  itemThumbImage: {
    width: '100%',
    height: '100%',
  },
  itemCopy: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 3,
  },
  itemMeta: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  itemButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  deleteButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f2',
  },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
  },
  pickupAddressText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  fieldBlock: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  fieldWrap: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  fieldInput: {
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  fieldInputMultiline: {
    minHeight: 90,
  },
  dropdownRow: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownValue: {
    flex: 1,
    fontSize: 15,
    marginRight: 10,
  },
  dropdownList: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  dropdownItem: {
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
  },
  dropdownItemSelected: {
    backgroundColor: '#ecfeff',
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownItemTextSelected: {
    color: '#0f766e',
  },
  actionStack: {
    marginTop: 14,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  deleteButtonLarge: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteButtonLargeText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '800',
  },
});
