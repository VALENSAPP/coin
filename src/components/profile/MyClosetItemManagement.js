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
import { useThemeContext } from '../../theme/ThemeContext';
import {
  deleteMyClosetItem,
  getMyClosetItems,
  updateMyClosetItem,
} from '../../services/myCloset';

const CONDITION_OPTIONS = [
  { label: 'New', value: 'New' },
  { label: 'Used', value: 'Used' },
  { label: 'Good condition', value: 'Good_condition' },
  { label: 'Needs attention', value: 'Need_attention' },
];

const SHIPPING_OPTIONS = [
  { label: 'Ship items', value: 'ship_items' },
  { label: 'Local pickup', value: 'local_pick' },
];

const RETURN_POLICY_OPTIONS = [
  'No returns',
  '7-day returns',
  '14-day returns',
  'Exchange only',
];

const CATEGORY_OPTIONS = [
  'Women > Jackets',
  'Women > Dresses',
  'Men > Shirts',
  'Accessories > Bags',
  'Shoes > Sneakers',
  'Home > Decor',
  'Vintage > Pieces',
  'Others'
];

const getOptionLabel = option =>
  typeof option === 'string' ? option : option?.label || option?.value || '';

const getOptionValue = option =>
  typeof option === 'string' ? option : option?.value || '';

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

const getShippingLabel = value => {
  switch (String(value || '').trim()) {
    case 'ship_items':
      return 'Ship items';
    case 'local_pick':
      return 'Local pickup';
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
});

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
  const { inputSurface, labelColor } = formSurfaces(isDarkMode);

  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: labelColor }]}>{label}</Text>
      <View style={[styles.fieldWrap, { backgroundColor: inputSurface, borderColor: withAlpha(accent, 0.16) }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#a1a1aa"
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
  const { inputSurface, labelColor } = formSurfaces(isDarkMode);
  const selectedOption = options.find(option => getOptionValue(option) === value);
  const displayValue = selectedOption ? getOptionLabel(selectedOption) : value;

  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: labelColor }]}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setExpanded(prev => !prev)}
        style={[styles.dropdownRow, { backgroundColor: inputSurface, borderColor: withAlpha(accent, 0.16) }]}
      >
        <Text style={[styles.dropdownValue, textStyle, !value && { color: '#a1a1aa' }]}>
          {displayValue || placeholder}
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={accent} />
      </TouchableOpacity>
      {expanded ? (
        <View style={[styles.dropdownList, { backgroundColor: inputSurface, borderColor: withAlpha(accent, 0.16) }]}>
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
                  { backgroundColor: inputSurface },
                  index !== options.length - 1 && styles.dropdownItemBorder,
                  selected && { backgroundColor: withAlpha(accent, 0.12) },
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
        <Text style={[styles.headerSubtitle, mutedTextStyle]}>{subtitle}</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
};

const MyClosetItemsManagementScreen = ({ navigation, route }) => {
  const { accent, bgStyle, cardStyle, textStyle, mutedTextStyle } = useAppTheme();
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
        error?.response?.data?.message || error?.message || 'Unable to load items.',
      );
      setItems([]);
    } finally {
      setLoading(false);
      dispatch(hideLoader());
    }
  }, [dispatch, toast]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems]),
  );

  const handleDelete = useCallback(
    item => {
      Alert.alert(
        'Delete item',
        'This will remove the item from your closet.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
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
                  showToastMessage(toast, 'success', 'Item deleted successfully.');
                  await loadItems();
                  return;
                }

                showToastMessage(
                  toast,
                  'danger',
                  response?.message || 'Unable to delete item.',
                );
              } catch (error) {
                showToastMessage(
                  toast,
                  'danger',
                  error?.response?.data?.message || error?.message || 'Unable to delete item.',
                );
              } finally {
                dispatch(hideLoader());
              }
            },
          },
        ],
      );
    },
    [dispatch, loadItems, toast],
  );

  const subtitle =
    section === 'orders'
      ? 'Recent orders and item management'
      : 'Manage, edit, and delete your closet items';

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <ClosestHeader
          title={section === 'orders' ? 'Recent Orders' : 'Your Items'}
          subtitle={subtitle}
          onBack={() => navigation.goBack()}
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
              <View key={normalized.id} style={[styles.itemCard, cardStyle, { borderColor: 'rgba(17,24,39,0.08)' }]}>
                <View style={styles.itemRowTop}>
                  <View style={styles.itemThumb}>
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
                    <Text style={[styles.itemMeta, mutedTextStyle]}>{getConditionLabel(normalized.condition)}</Text>
                  </View>
                </View>
                <View style={styles.itemButtonRow}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('MyClosetItemEditor', { item: normalized })}
                    style={[styles.actionButton, { borderColor: withAlpha(accent, 0.35) }]}
                  >
                    <Text style={[styles.actionButtonText, { color: accent }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleDelete(normalized)}
                    style={[styles.deleteButton, { borderColor: '#fecaca' }]}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        ) : (
          <View style={[styles.emptyCard, cardStyle]}>
            <Ionicons name="shirt-outline" size={28} color={accent} />
            <Text style={[styles.emptyTitle, textStyle]}>No items yet</Text>
            <Text style={[styles.emptyText, mutedTextStyle]}>Start by adding your first item.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const MyClosetItemEditorScreen = ({ navigation, route }) => {
  const { accent, bgStyle, cardStyle, textStyle, mutedTextStyle } = useAppTheme();
  const toast = useToast();
  const dispatch = useDispatch();
  const item = route?.params?.item || {};
  const [draft, setDraft] = useState(() => toEditableItem(item));
  const [saving, setSaving] = useState(false);

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
        showToastMessage(toast, 'success', response?.message || 'Item updated successfully.');
        navigation.goBack();
        return;
      }

      showToastMessage(
        toast,
        'danger',
        response?.message || 'Unable to update item.',
      );
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || 'Unable to update item.',
      );
    } finally {
      setSaving(false);
      dispatch(hideLoader());
    }
  }, [draft, dispatch, navigation, toast]);

  const handleDelete = useCallback(() => {
    if (!draft.id) return;
    Alert.alert('Delete item', 'This will permanently delete the item.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
              showToastMessage(toast, 'success', 'Item deleted successfully.');
              navigation.goBack();
              return;
            }

            showToastMessage(
              toast,
              'danger',
              response?.message || 'Unable to delete item.',
            );
          } catch (error) {
            showToastMessage(
              toast,
              'danger',
              error?.response?.data?.message || error?.message || 'Unable to delete item.',
            );
          } finally {
            setSaving(false);
            dispatch(hideLoader());
          }
        },
      },
    ]);
  }, [draft.id, dispatch, navigation, toast]);

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <ClosestHeader
          title="Edit Item"
          subtitle="/mycloset/items/{itemId}"
          onBack={() => navigation.goBack()}
          accent={accent}
          textStyle={textStyle}
          mutedTextStyle={mutedTextStyle}
        />

        <View style={[styles.formCard, cardStyle]}>
          <Field
            label="Item name"
            value={draft.name}
            onChangeText={value => setDraft(prev => ({ ...prev, name: value }))}
            placeholder="Vintage Leather Jacket"
            accent={accent}
          />
          <DropdownRow
            label="Category"
            value={draft.category}
            options={CATEGORY_OPTIONS}
            placeholder="Select category"
            onSelect={value => setDraft(prev => ({ ...prev, category: value }))}
            accent={accent}
          />
          <Field
            label="Brand"
            value={draft.brand}
            onChangeText={value => setDraft(prev => ({ ...prev, brand: value }))}
            placeholder="Brand"
            accent={accent}
          />
          <DropdownRow
            label="Condition"
            value={draft.condition}
            options={CONDITION_OPTIONS}
            placeholder="Select condition"
            onSelect={value => setDraft(prev => ({ ...prev, condition: value }))}
            accent={accent}
          />
          <Field
            label="Description"
            value={draft.description}
            onChangeText={value => setDraft(prev => ({ ...prev, description: value }))}
            placeholder="Describe the item"
            multiline
            accent={accent}
          />
          <Field
            label="Price"
            value={draft.price}
            onChangeText={value => setDraft(prev => ({ ...prev, price: value }))}
            placeholder="0.00"
            keyboardType="numeric"
            accent={accent}
          />
          <Field
            label="Quantity"
            value={draft.quantity}
            onChangeText={value => setDraft(prev => ({ ...prev, quantity: value }))}
            placeholder="1"
            keyboardType="numeric"
            accent={accent}
          />
          <DropdownRow
            label="Shipping option"
            value={draft.shippingOption}
            options={SHIPPING_OPTIONS}
            placeholder="Select shipping option"
            onSelect={value => setDraft(prev => ({ ...prev, shippingOption: value }))}
            accent={accent}
          />
          <Field
            label="Estimated shipping time"
            value={draft.shippingTime}
            onChangeText={value => setDraft(prev => ({ ...prev, shippingTime: value }))}
            placeholder="3 - 5 business days"
            accent={accent}
          />
          <DropdownRow
            label="Return policy"
            value={draft.returnPolicy}
            options={RETURN_POLICY_OPTIONS}
            placeholder="Select return policy"
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
           <Text style={styles.primaryButtonText}>Update Item</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleDelete}
            disabled={saving}
            style={styles.deleteButtonLarge}
          >
            <Text style={styles.deleteButtonLargeText}>Delete Item</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
