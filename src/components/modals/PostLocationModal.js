import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
  FlatList,
  Platform,
  PermissionsAndroid,
  StyleSheet,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import Icon from 'react-native-vector-icons/Ionicons';
import { useLanguage } from '../../i18n';
import {
  isGooglePlacesConfigured,
  reverseGeocodeCoordinates,
  searchPlacePredictions,
} from '../../services/googlePlaces';
import { useAppTheme } from '../../theme/useApptheme';

const withAlpha = (hex, alpha = 0.12) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(124,58,237,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const requestLocationPermission = async t => {
  if (Platform.OS === 'ios') {
    try {
      const status = await Geolocation.requestAuthorization('whenInUse');
      return status === 'granted';
    } catch {
      return false;
    }
  }

  if (Platform.OS !== 'android') return true;

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: t('postItem.locationPermissionTitle'),
      message: t('postItem.locationPermissionMessage'),
      buttonPositive: t('postItem.locationPermissionAllow'),
      buttonNegative: t('postItem.locationPermissionDeny'),
    },
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

const tryLoadLocationBias = async () => {
  if (Platform.OS === 'android') {
    const permitted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    if (!permitted) return null;
  }

  return readCachedCoordinates();
};

const readCachedCoordinates = () =>
  new Promise(resolve => {
    Geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position?.coords || {};
        if (
          typeof latitude === 'number' &&
          !Number.isNaN(latitude) &&
          typeof longitude === 'number' &&
          !Number.isNaN(longitude)
        ) {
          resolve({ latitude, longitude });
          return;
        }
        resolve(null);
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 600000,
      },
    );
  });

const PostLocationModal = ({
  visible,
  initialValue = '',
  saving = false,
  onClose,
  onSave,
}) => {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(initialValue);
  const [predictions, setPredictions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchError, setSearchError] = useState('');
  const debounceRef = useRef(null);
  const locationBiasRef = useRef(null);
  const hasPlacesApi = isGooglePlacesConfigured();
  const { accent, textStyle, cardStyle, mutedText, mutedTextStyle, icon } = useAppTheme();

  useEffect(() => {
    if (!visible) return;
    setDraft(initialValue);
    setPredictions([]);
    setSearchError('');
    locationBiasRef.current = null;

    if (!hasPlacesApi) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const coords = await tryLoadLocationBias();
        if (!cancelled && coords) {
          locationBiasRef.current = coords;
        }
      } catch {
        // Search still works without location bias.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, initialValue, hasPlacesApi]);

  useEffect(() => {
    if (!visible || !hasPlacesApi) {
      setPredictions([]);
      return undefined;
    }

    const query = draft.trim();
    if (query.length < 2) {
      setPredictions([]);
      setSearchError('');
      return undefined;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const bias = locationBiasRef.current;
        const results = await searchPlacePredictions(query, bias || undefined);
        setPredictions(results);
      } catch (error) {
        setPredictions([]);
        setSearchError(error?.message || t('postItem.locationSearchError'));
      } finally {
        setSearching(false);
      }
    }, 320);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft, hasPlacesApi, t, visible]);

  const handleSelectPrediction = useCallback(description => {
    setDraft(description);
    setPredictions([]);
  }, []);

  const handleUseCurrentLocation = useCallback(async () => {
    if (!hasPlacesApi || locating) return;

    setLocating(true);
    setSearchError('');
    try {
      const hasPermission = await requestLocationPermission(t);
      if (!hasPermission) {
        setSearchError(t('postItem.locationPermissionDenied'));
        return;
      }

      const position = await new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        });
      });

      const { latitude, longitude } = position?.coords || {};
      if (
        typeof latitude !== 'number' ||
        Number.isNaN(latitude) ||
        typeof longitude !== 'number' ||
        Number.isNaN(longitude)
      ) {
        throw new Error(t('postItem.locationUnavailable'));
      }

      locationBiasRef.current = { latitude, longitude };
      const label = await reverseGeocodeCoordinates(latitude, longitude);
      setDraft(label);
      setPredictions([]);
    } catch (error) {
      setSearchError(error?.message || t('postItem.locationUnavailable'));
    } finally {
      setLocating(false);
    }
  }, [hasPlacesApi, locating, t]);

  const handleSave = useCallback(() => {
    onSave?.(draft.trim());
  }, [draft, onSave]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.card, cardStyle]}>
              <Text style={[styles.title, textStyle]}>{t('postItem.editLocationTitle')}</Text>
              <Text style={[styles.hint, mutedTextStyle]}>{t('postItem.editLocationHint')}</Text>

              <TextInput
                style={[styles.input, cardStyle, textStyle, { borderColor: withAlpha(accent, 0.25) }]}
                value={draft}
                onChangeText={setDraft}
                placeholder={t('postItem.searchLocationPlaceholder')}
                placeholderTextColor={mutedText}
                autoFocus
                maxLength={160}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              {hasPlacesApi ? (
                <TouchableOpacity
                  style={styles.currentLocationBtn}
                  onPress={handleUseCurrentLocation}
                  disabled={locating || saving}>
                  {locating ? (
                    <ActivityIndicator size="small" color={accent} />
                  ) : (
                    <>
                      <Icon name="navigate" size={16} color={accent} />
                      <Text style={[styles.currentLocationText, { color: accent }]}>
                        {t('postItem.useCurrentLocation')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <Text style={[styles.apiWarning, mutedTextStyle]}>{t('postItem.placesApiMissing')}</Text>
              )}

              {searching ? (
                <View style={styles.searchingRow}>
                  <ActivityIndicator size="small" color={accent} />
                </View>
              ) : null}

              {!!searchError && <Text style={styles.errorText}>{searchError}</Text>}

              {predictions.length > 0 ? (
                <FlatList
                  data={predictions}
                  keyExtractor={item => item.id}
                  keyboardShouldPersistTaps="handled"
                  style={[styles.predictionsList, cardStyle, { borderColor: withAlpha(accent, 0.2) }]}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.predictionRow, { borderBottomColor: withAlpha(accent, 0.12) }]}
                      onPress={() => handleSelectPrediction(item.description)}>
                      <Icon
                        name={
                          item.types?.includes('establishment')
                            ? 'storefront-outline'
                            : 'location-outline'
                        }
                        size={16}
                        color={icon}
                      />
                      <Text style={[styles.predictionText, textStyle]} numberOfLines={2}>
                        {item.description}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              ) : null}

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled, { backgroundColor: accent }]}
                onPress={handleSave}
                disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>{t('postItem.saveLocation')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                <Text style={[styles.cancelText, { color: accent }]}>{t('postItem.cancelLocation')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  hint: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: '#111827',
    marginBottom: 10,
  },
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  currentLocationText: {
    fontWeight: '600',
    fontSize: 14,
  },
  apiWarning: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  searchingRow: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginBottom: 8,
  },
  predictionsList: {
    maxHeight: 180,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 10,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  predictionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  saveBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    fontWeight: '600',
    fontSize: 14,
  },
});

export default PostLocationModal;
