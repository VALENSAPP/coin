import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import { useFocusEffect } from '@react-navigation/native';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';
import {
  createMyCloset,
  deleteMyCloset,
  getMyClosetMe,
  updateMyCloset,
} from '../../services/myCloset';

const defaultState = {
  shopName: '',
  shopUsername: '',
  description: '',
  shopLogo: null,
  shippingOptions: '',
  returnPolicy: '',
  paymentMethod: '',
  shopPreferences: '',
  notificationsEnabled: true,
};

const stripPrefix = value => String(value || '').replace(/^valens\.app\//i, '');

const normalizeUrl = value => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return `https://api.valens.app${raw}`;
  return `https://api.valens.app/${raw}`;
};

const getFirstPresent = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value != null && String(value).trim() !== '') return value;
  }
  return '';
};

const normalizeShopData = source => {
  const data = source?.data || source || {};
  const shopLogo =
    getFirstPresent(data, ['shopLogo', 'shopLogoUrl', 'logo', 'logoUrl', 'image']) || null;

  return {
    shopName: getFirstPresent(data, ['shopName', 'name', 'businessName', 'displayName']),
    shopUsername: stripPrefix(
      getFirstPresent(data, ['shopUsername', 'username', 'userName', 'handle']),
    ),
    description: getFirstPresent(data, ['description', 'shopDescription', 'about']),
    shopLogo: typeof shopLogo === 'string' ? normalizeUrl(shopLogo) : shopLogo,
    shippingOptions: getFirstPresent(data, ['shippingOptions', 'shippingPolicy']),
    returnPolicy: getFirstPresent(data, ['returnPolicy', 'returnsPolicy']),
    paymentMethod: getFirstPresent(data, ['paymentMethod', 'paymentMethods']),
    shopPreferences: getFirstPresent(data, ['shopPreferences', 'preferences']),
    notificationsEnabled:
      data?.notificationsEnabled == null ? true : Boolean(data.notificationsEnabled),
  };
};

const toPickableFile = asset => {
  if (!asset?.uri) return null;
  return {
    uri: asset.uri,
    name: asset.fileName || `shop-logo-${Date.now()}.jpg`,
    type: asset.type || 'image/jpeg',
  };
};

const EditModal = ({
  visible,
  title,
  value,
  placeholder,
  multiline = false,
  onCancel,
  onSave,
}) => {
  const { text } = useAppTheme();
  const [draftValue, setDraftValue] = useState(value || '');

  useEffect(() => {
    if (visible) {
      setDraftValue(value || '');
    }
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput
            value={draftValue}
            onChangeText={setDraftValue}
            placeholder={placeholder}
            placeholderTextColor="#a1a1aa"
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            style={[
              styles.modalInput,
              multiline && styles.modalInputMultiline,
              { borderColor: 'rgba(91, 33, 182, 0.18)' },
            ]}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity activeOpacity={0.9} onPress={onCancel} style={styles.modalSecondary}>
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onSave(draftValue)}
              style={[styles.modalPrimary, { backgroundColor: text }]}
            >
              <Text style={styles.modalPrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const Row = ({ label, value, onPress, multiline = false, subtitle }) => (
  <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.row}>
    <View style={styles.rowCopy}>
      <Text style={styles.rowLabel}>{label}</Text>
      {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      {value ? (
        <Text style={[styles.rowValue, multiline && styles.rowValueMultiline]} numberOfLines={multiline ? 3 : 1}>
          {value}
        </Text>
      ) : null}
    </View>
    <View style={styles.rowRight}>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </View>
  </TouchableOpacity>
);

const ShopSettingsScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const toast = useToast();
  const { bgStyle, textStyle, text, cardStyle } = useAppTheme();
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(defaultState);
  const [activeField, setActiveField] = useState(null);

  const loadShopSettings = useCallback(async () => {
    dispatch(showLoader());
    try {
      const [apiResponse, draftValue] = await Promise.all([
        getMyClosetMe().catch(error => error?.response?.data || null),
        AsyncStorage.getItem('myClosetDraft'),
      ]);

      const apiData = apiResponse?.statusCode ? apiResponse : apiResponse?.data || apiResponse;
      const normalizedApiData = normalizeShopData(apiData);
      let normalizedDraft = null;

      if (draftValue) {
        try {
          normalizedDraft = normalizeShopData({ data: JSON.parse(draftValue) });
        } catch (parseError) {
          console.warn('ShopSettings draft parse error:', parseError);
        }
      }

      setData(prev => ({
        ...prev,
        ...(normalizedDraft || {}),
        ...normalizedApiData,
      }));
    } catch (error) {
      console.warn('ShopSettings load error:', error);
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || 'Failed to load shop settings.',
      );
    } finally {
      dispatch(hideLoader());
    }
  }, [dispatch, toast]);

  useFocusEffect(
    useCallback(() => {
      loadShopSettings();
    }, [loadShopSettings]),
  );

  const shopLink = useMemo(() => {
    const handle = String(data.shopUsername || '').trim().toLowerCase();
    return handle ? `valens.app/${handle}` : 'valens.app/your-shop';
  }, [data.shopUsername]);

  const handleImagePick = useCallback(async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: false,
        quality: 0.9,
      });

      if (response?.didCancel || response?.errorCode) return;
      const asset = response?.assets?.[0];
      const file = toPickableFile(asset);
      if (!file) return;

      setData(prev => ({
        ...prev,
        shopLogo: file,
      }));
    } catch (error) {
      console.warn('Shop logo picker error:', error);
      showToastMessage(toast, 'danger', 'Unable to open photo library.');
    }
  }, [toast]);

  const handleSave = useCallback(async () => {
    const payload = {
      shopName: String(data.shopName || '').trim(),
      shopUsername: String(data.shopUsername || '').trim(),
      description: String(data.description || '').trim(),
      shippingOptions: String(data.shippingOptions || '').trim(),
      returnPolicy: String(data.returnPolicy || '').trim(),
      paymentMethod: String(data.paymentMethod || '').trim(),
      shopPreferences: String(data.shopPreferences || '').trim(),
      notifications: data.notificationsEnabled ? 'enabled' : 'disabled',
      shopLogo: data.shopLogo,
    };

    setSaving(true);
    dispatch(showLoader());
    try {
      let response = await updateMyCloset(payload);

      if (response?.statusCode === 404 || response?.error) {
        response = await createMyCloset(payload);
      }

      if (response?.statusCode === 200 || response?.statusCode === 201) {
        showToastMessage(
          toast,
          'success',
          response?.message || 'Shop settings saved successfully.',
        );

        if (payload.shopUsername) {
          await AsyncStorage.setItem(
            'myClosetDraft',
            JSON.stringify({
              ...data,
              shopUsername: payload.shopUsername,
            }),
          );
        }

        return;
      }

      showToastMessage(
        toast,
        'danger',
        response?.message || 'Unable to save shop settings.',
      );
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || 'Unable to save shop settings.',
      );
    } finally {
      setSaving(false);
      dispatch(hideLoader());
    }
  }, [data, dispatch, toast]);

  const handleDeleteCloset = useCallback(() => {
    Alert.alert(
      'Delete My Closet',
      'This will permanently delete your closet and its settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            dispatch(showLoader());
            try {
              const response = await deleteMyCloset();
              const deleted =
                response?.statusCode === 200 ||
                response?.statusCode === 204 ||
                response === '' ||
                response == null;

              if (deleted) {
                await AsyncStorage.multiRemove(['myClosetCreated', 'myClosetDraft']);
                showToastMessage(
                  toast,
                  'success',
                  response?.message || 'My Closet deleted successfully.',
                );
                navigation.goBack();
                return;
              }

              showToastMessage(
                toast,
                'danger',
                response?.message || 'Unable to delete My Closet.',
              );
            } catch (error) {
              showToastMessage(
                toast,
                'danger',
                error?.response?.data?.message || error?.message || 'Unable to delete My Closet.',
              );
            } finally {
              setSaving(false);
              dispatch(hideLoader());
            }
          },
        },
      ],
    );
  }, [dispatch, navigation, toast]);

  const activeModalConfig = {
    shopName: {
      title: 'Edit shop name',
      placeholder: "e.g. Graziela's Closet",
      multiline: false,
    },
    shopUsername: {
      title: 'Edit username',
      placeholder: 'grazielascloset',
      multiline: false,
    },
    description: {
      title: 'Edit description',
      placeholder: 'Curated pieces with timeless style.',
      multiline: true,
    },
    shippingOptions: {
      title: 'Shipping & return policy',
      placeholder: 'Tell buyers how shipping and returns work.',
      multiline: true,
    },
    paymentMethod: {
      title: 'Payment methods',
      placeholder: 'Stripe, cash, card, etc.',
      multiline: true,
    },
    shopPreferences: {
      title: 'Shop preferences',
      placeholder: 'Preferred style, audience, order rules...',
      multiline: true,
    },
  }[activeField];

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <View style={styles.container}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View
              style={[
                styles.heroCard,
                cardStyle,
                { borderColor: 'rgba(91, 33, 182, 0.10)' },
              ]}
            >
              <Text style={[styles.sectionHeaderText, textStyle]}>
                Shop information
              </Text>
              <Text style={styles.heroSubtext}>
                Update the details customers see when they visit your shop.
              </Text>

              <View style={styles.previewBlock}>
                <View style={styles.previewLogoWrap}>
                  {data.shopLogo ? (
                    <Image
                      source={{ uri: data.shopLogo.uri || data.shopLogo }}
                      style={styles.previewLogo}
                    />
                  ) : (
                    <View
                      style={[
                        styles.previewLogo,
                        styles.previewLogoEmpty,
                        { borderColor: 'rgba(91, 33, 182, 0.18)' },
                      ]}
                    >
                      <Ionicons name="bag-handle-outline" size={26} color={text} />
                    </View>
                  )}
                </View>
                <View style={styles.previewCopy}>
                  <Text style={[styles.previewTitle, textStyle]} numberOfLines={1}>
                    {data.shopName || 'Your Shop'}
                  </Text>
                  <Text style={styles.previewHandle}>{shopLink}</Text>
                  <Text style={styles.previewDescription} numberOfLines={2}>
                    {data.description || 'Add a short description for your shop.'}
                  </Text>
                </View>
              </View>

              <View style={styles.rowsCard}>
                <Row
                  label="Shop name"
                  value={data.shopName || 'Tap to add'}
                  onPress={() => setActiveField('shopName')}
                />
                <View style={styles.rowDivider} />
                <Row
                  label="Username"
                  value={`valens.app/${data.shopUsername || 'your-shop'}`}
                  subtitle="This is your public shop link"
                  onPress={() => setActiveField('shopUsername')}
                />
                <View style={styles.rowDivider} />
                <Row
                  label="Shop description"
                  value={data.description || 'Tap to describe your shop'}
                  multiline
                  onPress={() => setActiveField('description')}
                />
                <View style={styles.rowDivider} />
                <Row
                  label="Shop logo"
                  value={data.shopLogo ? 'Logo uploaded' : 'Add a logo'}
                  subtitle="Use a square image for best results."
                  onPress={handleImagePick}
                />
              </View>
            </View>

            {/* <View
              style={[
                styles.sectionCard,
                cardStyle,
                { borderColor: 'rgba(91, 33, 182, 0.10)' },
              ]}
            >
              <Text style={[styles.sectionHeaderText, textStyle]}>
                More settings
              </Text>
              <View style={styles.rowsCard}>
                <Row
                  label="Shipping & return policy"
                  value={data.shippingOptions || data.returnPolicy || 'Configure shipping rules'}
                  subtitle="Set how you ship and handle returns."
                  onPress={() => setActiveField('shippingOptions')}
                />
                <View style={styles.rowDivider} />
                <Row
                  label="Payment methods"
                  value={data.paymentMethod || 'Choose payment methods'}
                  subtitle="Tell buyers how they can pay."
                  onPress={() => setActiveField('paymentMethod')}
                />
                <View style={styles.rowDivider} />
                <Row
                  label="Shop preferences"
                  value={data.shopPreferences || 'Set your shop defaults'}
                  subtitle="Audience, style, and ordering preferences."
                  onPress={() => setActiveField('shopPreferences')}
                />
                <View style={styles.rowDivider} />
                <View style={styles.notificationRow}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowLabel}>Notifications</Text>
                    <Text style={styles.rowSubtitle}>
                      Receive updates for shop activity.
                    </Text>
                  </View>
                  <Switch
                    value={data.notificationsEnabled}
                    onValueChange={value =>
                      setData(prev => ({ ...prev, notificationsEnabled: value }))
                    }
                    thumbColor="#fff"
                    trackColor={{ false: '#e5e7eb', true: text }}
                  />
                </View>
              </View>
            </View> */}

            <View style={styles.footerCard}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleSave}
                disabled={saving}
                style={[
                  styles.saveButton,
                  { backgroundColor: text, opacity: saving ? 0.8 : 1 },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save changes</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleDeleteCloset}
                disabled={saving}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteButtonText}>Delete My Closet</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

        <EditModal
          visible={Boolean(activeModalConfig)}
          title={activeModalConfig?.title || ''}
          value={String(data[activeField] || '')}
          placeholder={activeModalConfig?.placeholder || ''}
          multiline={activeModalConfig?.multiline}
          onCancel={() => setActiveField(null)}
          onSave={value => {
            setData(prev => ({ ...prev, [activeField]: value }));
            setActiveField(null);
          }}
        />
      </View>
    </SafeAreaView>
  );
};

export default ShopSettingsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSpacer: {
    width: 42,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtext: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6b7280',
    marginBottom: 14,
  },
  previewBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  previewLogoWrap: {
    marginRight: 12,
  },
  previewLogo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLogoEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  previewCopy: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  previewHandle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
    fontWeight: '600',
  },
  previewDescription: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  rowsCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  row: {
    minHeight: 72,
    paddingVertical: 14,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowCopy: {
    flex: 1,
    paddingRight: 12,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  rowValue: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  rowValueMultiline: {
    lineHeight: 19,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 6,
  },
  notificationRow: {
    minHeight: 72,
    paddingVertical: 14,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerCard: {
    paddingTop: 2,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  deleteButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
  },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    padding: 20,
    justifyContent: 'center',
  },
  modalCard: {
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    color: '#111827',
  },
  modalInput: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  modalInputMultiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 10,
  },
  modalSecondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  modalSecondaryText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  modalPrimary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
