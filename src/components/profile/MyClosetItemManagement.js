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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import {
  deleteMyClosetItem,
  getMyClosetItems,
  updateMyClosetItem,
} from '../../services/myCloset';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

// Option lists are functions of `t` so they stay in sync when the language changes.
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

const extractItemImage = item => item?.images?.[0] || item?.image || item?.thumbnail || null;

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
}) => (
  <View style={styles.fieldBlock}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.fieldWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#a1a1aa"
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
      />
    </View>
  </View>
);

const DropdownRow = ({ label, value, options, onSelect, placeholder }) => {
  const [expanded, setExpanded] = useState(false);
  const selectedOption = options.find(option => getOptionValue(option) === value);
  const displayValue = selectedOption ? getOptionLabel(selectedOption) : value;

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setExpanded(prev => !prev)}
        style={styles.dropdownRow}
      >
        <Text style={[styles.dropdownValue, !value && { color: '#a1a1aa' }]}>
          {displayValue || placeholder}
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#111827" />
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.dropdownList}>
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
                  index !== options.length - 1 && styles.dropdownItemBorder,
                  selected && styles.dropdownItemSelected,
                ]}
              >
                <Text style={[styles.dropdownItemText, selected && styles.dropdownItemTextSelected]}>
                  {optionLabel}
                </Text>
                {selected ? <Ionicons name="checkmark" size={16} color="#14b8a6" /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const toEditableItem = item => ({
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
  returnPolicy: item?.returnPolicy || '',
  image: extractItemImage(item),
});

const buildPayload = draft => ({
  name: draft.name,
  category: draft.category,
  brand: draft.brand,
  condition: draft.condition,
  description: draft.description,
  price: draft.price,
  quantity: draft.quantity,
  shippingOption: draft.shippingOption,
  shippingOptions: draft.shippingOption,
  estimateShippingTime: draft.shippingTime,
  returnPolicy: draft.returnPolicy,
});

const ClosestHeader = ({ title, subtitle, onBack }) => (
  <View style={styles.headerRow}>
    <TouchableOpacity activeOpacity={0.85} onPress={onBack} style={styles.backButton}>
      <Ionicons name="chevron-back" size={22} color="#111827" />
    </TouchableOpacity>
    <View style={styles.headerCopy}>
      <Text style={styles.headerTitle}>{title}</Text>
      {subtitle &&
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      }
    </View>
    <View style={styles.headerSpacer} />
  </View>
);

const MyClosetItemsManagementScreen = ({ navigation, route }) => {
  const { text, bgStyle, cardStyle, textStyle } = useAppTheme();
  const { t } = useLanguage();
  const toast = useToast();
  const dispatch = useDispatch();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const section = route?.params?.section || 'items';

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
          onBack={() => navigation.goBack()}
        />

        {loading ? (
          <>
          </>
        ) : items.length ? (
          items.map(item => {
            const normalized = toEditableItem(item);
            return (
              <View key={normalized.id} style={[styles.itemCard, cardStyle, { borderColor: 'rgba(17,24,39,0.08)' }]}>
                <View style={styles.itemRowTop}>
                  <View style={styles.itemThumb}>
                    {normalized.image ? (
                      <Image source={{ uri: normalized.image }} style={styles.itemThumbImage} />
                    ) : (
                      <Ionicons name="shirt-outline" size={24} color={text} />
                    )}
                  </View>
                  <View style={styles.itemCopy}>
                    <Text style={[styles.itemTitle, textStyle]} numberOfLines={1}>
                      {normalized.name}
                    </Text>
                    <Text style={styles.itemMeta}>{formatPrice(normalized.price)}</Text>
                    <Text style={styles.itemMeta}>{getConditionLabel(normalized.condition, t)}</Text>
                  </View>
                </View>
                <View style={styles.itemButtonRow}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('MyClosetItemEditor', { item: normalized })}
                    style={[styles.actionButton, { borderColor: text }]}
                  >
                    <Text style={[styles.actionButtonText, { color: text }]}>{t('myClosetItems.edit')}</Text>
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
          <View style={[styles.emptyCard, cardStyle]}>
            <Ionicons name="shirt-outline" size={28} color={text} />
            <Text style={[styles.emptyTitle, textStyle]}>{t('myClosetItems.emptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('myClosetItems.emptyText')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const MyClosetItemEditorScreen = ({ navigation, route }) => {
  const { text, bgStyle, cardStyle, textStyle } = useAppTheme();
  const { t } = useLanguage();
  const toast = useToast();
  const dispatch = useDispatch();
  const item = route?.params?.item || {};
  const [draft, setDraft] = useState(() => toEditableItem(item));
  const [saving, setSaving] = useState(false);

  const CONDITION_OPTIONS = useMemo(() => getConditionOptions(t), [t]);
  const SHIPPING_OPTIONS = useMemo(() => getShippingOptions(t), [t]);
  const RETURN_POLICY_OPTIONS = useMemo(() => getReturnPolicyOptions(t), [t]);
  const CATEGORY_OPTIONS = useMemo(() => getCategoryOptions(t), [t]);

  useEffect(() => {
    setDraft(toEditableItem(item));
  }, [item]);

  const handleSave = useCallback(async () => {
    if (!draft.id) return;
    setSaving(true);
    dispatch(showLoader());
    try {
      const response = await updateMyClosetItem(draft.id, buildPayload(draft));
      if (response?.statusCode === 200 || response?.statusCode === 201) {
        showToastMessage(toast, 'success', response?.message || t('myClosetItemEditor.updateSuccess'));
        navigation.goBack();
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
  }, [draft, dispatch, navigation, toast, t]);

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
              navigation.goBack();
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
  }, [draft.id, dispatch, navigation, toast, t]);

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
          // subtitle="/mycloset/items/{itemId}"
          onBack={() => navigation.goBack()}
        />

        <View style={[styles.formCard, cardStyle]}>
          <Field
            label={t('myClosetItemEditor.itemNameLabel')}
            value={draft.name}
            onChangeText={value => setDraft(prev => ({ ...prev, name: value }))}
            placeholder={t('myClosetItemEditor.itemNamePlaceholder')}
          />
          <DropdownRow
            label={t('myClosetItemEditor.categoryLabel')}
            value={draft.category}
            options={CATEGORY_OPTIONS}
            placeholder={t('myClosetItemEditor.categoryPlaceholder')}
            onSelect={value => setDraft(prev => ({ ...prev, category: value }))}
          />
          <Field
            label={t('myClosetItemEditor.brandLabel')}
            value={draft.brand}
            onChangeText={value => setDraft(prev => ({ ...prev, brand: value }))}
            placeholder={t('myClosetItemEditor.brandPlaceholder')}
          />
          <DropdownRow
            label={t('myClosetItemEditor.conditionLabel')}
            value={draft.condition}
            options={CONDITION_OPTIONS}
            placeholder={t('myClosetItemEditor.conditionPlaceholder')}
            onSelect={value => setDraft(prev => ({ ...prev, condition: value }))}
          />
          <Field
            label={t('myClosetItemEditor.descriptionLabel')}
            value={draft.description}
            onChangeText={value => setDraft(prev => ({ ...prev, description: value }))}
            placeholder={t('myClosetItemEditor.descriptionPlaceholder')}
            multiline
          />
          <Field
            label={t('myClosetItemEditor.priceLabel')}
            value={draft.price}
            onChangeText={value => setDraft(prev => ({ ...prev, price: value }))}
            placeholder={t('myClosetItemEditor.pricePlaceholder')}
            keyboardType="numeric"
          />
          <Field
            label={t('myClosetItemEditor.quantityLabel')}
            value={draft.quantity}
            onChangeText={value => setDraft(prev => ({ ...prev, quantity: value }))}
            placeholder={t('myClosetItemEditor.quantityPlaceholder')}
            keyboardType="numeric"
          />
          <DropdownRow
            label={t('myClosetItemEditor.shippingOptionLabel')}
            value={draft.shippingOption}
            options={SHIPPING_OPTIONS}
            placeholder={t('myClosetItemEditor.shippingOptionPlaceholder')}
            onSelect={value => setDraft(prev => ({ ...prev, shippingOption: value }))}
          />
          <Field
            label={t('myClosetItemEditor.shippingTimeLabel')}
            value={draft.shippingTime}
            onChangeText={value => setDraft(prev => ({ ...prev, shippingTime: value }))}
            placeholder={t('myClosetItemEditor.shippingTimePlaceholder')}
          />
          <DropdownRow
            label={t('myClosetItemEditor.returnPolicyLabel')}
            value={draft.returnPolicy}
            options={RETURN_POLICY_OPTIONS}
            placeholder={t('myClosetItemEditor.returnPolicyPlaceholder')}
            onSelect={value => setDraft(prev => ({ ...prev, returnPolicy: value }))}
          />
        </View>

        <View style={styles.actionStack}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSave}
            disabled={saving}
            style={[styles.primaryButton, { backgroundColor: text, opacity: saving ? 0.8 : 1 }]}
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
    backgroundColor: '#fff',
  },
  headerCopy: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#6b7280',
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
    backgroundColor: '#fff',
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
    color: '#111827',
    marginBottom: 3,
  },
  itemMeta: {
    fontSize: 12,
    color: '#6b7280',
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
    backgroundColor: '#fff',
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
    borderColor: '#e5e7eb',
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    backgroundColor: '#fff',
  },
  fieldBlock: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 8,
  },
  fieldWrap: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  fieldInput: {
    fontSize: 15,
    color: '#111827',
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  fieldInputMultiline: {
    minHeight: 90,
  },
  dropdownRow: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownValue: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    marginRight: 10,
  },
  dropdownList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  dropdownItem: {
    minHeight: 46,
    paddingHorizontal: 12,
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
    backgroundColor: '#ecfeff',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#111827',
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
