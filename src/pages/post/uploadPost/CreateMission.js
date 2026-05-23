import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import CountryPicker from 'react-native-country-picker-modal';
import CustomButton from '../../../components/customButton/customButton';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useDispatch, useSelector } from 'react-redux';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { createPost } from '../../../services/post';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../../theme/useApptheme';
import { useLanguage } from '../../../i18n';

// Currency mapping by country code
const CURRENCY_MAP = {
  // North America
  US: { code: 'USD', symbol: '$' },
  CA: { code: 'CAD', symbol: 'C$' },
  MX: { code: 'MXN', symbol: '$' },

  // Europe
  GB: { code: 'GBP', symbol: '£' },
  DE: { code: 'EUR', symbol: '€' },
  FR: { code: 'EUR', symbol: '€' },
  IT: { code: 'EUR', symbol: '€' },
  ES: { code: 'EUR', symbol: '€' },
  NL: { code: 'EUR', symbol: '€' },
  BE: { code: 'EUR', symbol: '€' },
  AT: { code: 'EUR', symbol: '€' },
  PT: { code: 'EUR', symbol: '€' },
  GR: { code: 'EUR', symbol: '€' },
  IE: { code: 'EUR', symbol: '€' },
  FI: { code: 'EUR', symbol: '€' },
  CH: { code: 'CHF', symbol: 'CHF' },
  NO: { code: 'NOK', symbol: 'kr' },
  SE: { code: 'SEK', symbol: 'kr' },
  DK: { code: 'DKK', symbol: 'kr' },
  PL: { code: 'PLN', symbol: 'zł' },
  CZ: { code: 'CZK', symbol: 'Kč' },
  HU: { code: 'HUF', symbol: 'Ft' },
  RO: { code: 'RON', symbol: 'lei' },
  RU: { code: 'RUB', symbol: '₽' },
  UA: { code: 'UAH', symbol: '₴' },
  TR: { code: 'TRY', symbol: '₺' },

  // Asia
  IN: { code: 'INR', symbol: '₹' },
  CN: { code: 'CNY', symbol: '¥' },
  JP: { code: 'JPY', symbol: '¥' },
  KR: { code: 'KRW', symbol: '₩' },
  SG: { code: 'SGD', symbol: 'S$' },
  MY: { code: 'MYR', symbol: 'RM' },
  TH: { code: 'THB', symbol: '฿' },
  VN: { code: 'VND', symbol: '₫' },
  ID: { code: 'IDR', symbol: 'Rp' },
  PH: { code: 'PHP', symbol: '₱' },
  PK: { code: 'PKR', symbol: '₨' },
  BD: { code: 'BDT', symbol: '৳' },
  LK: { code: 'LKR', symbol: 'Rs' },
  HK: { code: 'HKD', symbol: 'HK$' },
  TW: { code: 'TWD', symbol: 'NT$' },
  IL: { code: 'ILS', symbol: '₪' },

  // Middle East
  AE: { code: 'AED', symbol: 'د.إ' },
  SA: { code: 'SAR', symbol: 'ر.س' },
  QA: { code: 'QAR', symbol: 'ر.ق' },
  KW: { code: 'KWD', symbol: 'د.ك' },
  BH: { code: 'BHD', symbol: 'د.ب' },
  OM: { code: 'OMR', symbol: 'ر.ع' },
  JO: { code: 'JOD', symbol: 'د.ا' },
  LB: { code: 'LBP', symbol: 'ل.ل' },

  // Oceania
  AU: { code: 'AUD', symbol: 'A$' },
  NZ: { code: 'NZD', symbol: 'NZ$' },

  // Africa
  ZA: { code: 'ZAR', symbol: 'R' },
  NG: { code: 'NGN', symbol: '₦' },
  EG: { code: 'EGP', symbol: 'E£' },
  KE: { code: 'KES', symbol: 'KSh' },
  MA: { code: 'MAD', symbol: 'د.م.' },
  GH: { code: 'GHS', symbol: 'GH₵' },
  TZ: { code: 'TZS', symbol: 'TSh' },
  UG: { code: 'UGX', symbol: 'USh' },
  ET: { code: 'ETB', symbol: 'Br' },

  // South America
  BR: { code: 'BRL', symbol: 'R$' },
  AR: { code: 'ARS', symbol: '$' },
  CL: { code: 'CLP', symbol: '$' },
  CO: { code: 'COP', symbol: '$' },
  PE: { code: 'PEN', symbol: 'S/' },
  VE: { code: 'VES', symbol: 'Bs.' },
  UY: { code: 'UYU', symbol: '$U' },

  // Central America & Caribbean
  CR: { code: 'CRC', symbol: '₡' },
  PA: { code: 'PAB', symbol: 'B/.' },
  GT: { code: 'GTQ', symbol: 'Q' },
  JM: { code: 'JMD', symbol: 'J$' },
  TT: { code: 'TTD', symbol: 'TT$' },

  // Other
  IS: { code: 'ISK', symbol: 'kr' },
  HR: { code: 'HRK', symbol: 'kn' },
  RS: { code: 'RSD', symbol: 'дин.' },
  BG: { code: 'BGN', symbol: 'лв' },
};

const CreateMission = () => {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('start');
  const [activeField, setActiveField] = useState(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [initialCurrency, setInitialCurrency] = useState('USD');

  const navigation = useNavigation();
  const dispatch = useDispatch();
  const route = useRoute();
  const toast = useToast();
  const { bgStyle, textStyle, text } = useAppTheme();
  const { t } = useLanguage();

  const userProfile = useSelector(state => state.user?.profile || state.auth?.user);

  const {
    images,
    caption,
    link,
    taggedPeople = [],
    taggedPeopleIds = [],
    taggedPeopleMeta = [],
  } = route.params || {};
  // Validation Schema — built inside component so `t` is available
  const validationSchema = Yup.object().shape({
    raiseAmount: Yup.string()
      .required(t('createMission.raiseAmountRequired'))
      .test('is-valid-number', t('createMission.raiseAmountInvalid'), (value) => {
        if (!value) return false;
        const numericValue = parseFloat(value.replace(/,/g, ''));
        return !isNaN(numericValue) && numericValue > 0;
      }),
    startTime: Yup.date()
      .required(t('createMission.startDateRequired'))
      .nullable(),
    endTime: Yup.date()
      .required(t('createMission.endDateRequired'))
      .nullable()
      .min(Yup.ref('startTime'), t('createMission.endDateAfterStart')),
    currency: Yup.string().required(t('createMission.currencyRequired')),
  });

  useEffect(() => {
    if (userProfile?.country && !selectedCountry) {
      const countryCode = userProfile.country.toUpperCase();
      const currency = CURRENCY_MAP[countryCode] || CURRENCY_MAP['US'];
      setSelectedCountry({ cca2: countryCode, currency: [currency.code] });
    } else if (!userProfile?.country && !selectedCountry) {
      setSelectedCountry({ cca2: 'US', currency: ['USD'] });
    }
  }, [userProfile, selectedCountry]);

  useEffect(() => {
    if (userProfile?.country) {
      const countryCode = userProfile.country.toUpperCase();
      const currency = CURRENCY_MAP[countryCode] || CURRENCY_MAP['US'];
      setSelectedCountry({ cca2: countryCode });
      setInitialCurrency(currency.code);
    }
  }, [userProfile]);

  const showDatePicker = (mode, setFieldValue, setFieldTouched) => {
    setPickerMode(mode);
    setActiveField({ setFieldValue, setFieldTouched });
    setShowPicker(true);
  };

  const handleConfirm = (date) => {
    setShowPicker(false);
    if (activeField) {
      const fieldName = pickerMode === 'start' ? 'startTime' : 'endTime';
      activeField.setFieldValue(fieldName, date);
      activeField.setFieldTouched(fieldName, true);
    } else {
      console.log('activeField is null!');
    }
  };

  const handleCancel = () => {
    setShowPicker(false);
  };

  const formatDateTime = (date) => {
    if (!date) return null;
    return new Date(date).toISOString();
  };

  const formatEndDateTime = (date) => {
    if (!date) return null;
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 0);
    return endDate.toISOString();
  };

  const formatDateDisplay = (dateString) => {
    const date = dateString ? new Date(dateString) : new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatNumberWithCommas = (value) => {
    if (!value) return '';
    const numericValue = value.replace(/[^0-9.]/g, '');
    const parts = numericValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0];
  };

  const handleAmountChange = (text, setFieldValue) => {
    const formatted = formatNumberWithCommas(text);
    setFieldValue('raiseAmount', formatted);
  };

  const getCurrencyInfo = (countryCode) => {
    return CURRENCY_MAP[countryCode] || CURRENCY_MAP['US'];
  };

  const onSelectCountry = (country, setFieldValue) => {
    setSelectedCountry(country);
    const currencyInfo = getCurrencyInfo(country.cca2);
    setFieldValue('currency', currencyInfo.code);
    setShowCountryPicker(false);
  };

  const handlePost = async (values, { setFieldError, setFieldTouched, validateForm, resetForm }) => {
    setFieldTouched('raiseAmount', true, false);
    setFieldTouched('startTime', true, false);
    setFieldTouched('endTime', true, false);
    setFieldTouched('currency', true, false);

    let hasErrors = false;

    if (!values.raiseAmount) {
      setFieldError('raiseAmount', t('createMission.raiseAmountRequired'));
      hasErrors = true;
    }

    if (!values.startTime) {
      setFieldError('startTime', t('createMission.startDateRequired'));
      hasErrors = true;
    }

    if (!values.endTime) {
      setFieldError('endTime', t('createMission.endDateRequired'));
      hasErrors = true;
    } else if (values.startTime && values.endTime && values.endTime <= values.startTime) {
      setFieldError('endTime', t('createMission.endDateAfterStart'));
      hasErrors = true;
    }

    if (!values.currency) {
      setFieldError('currency', t('createMission.currencyRequired'));
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    const numericValue = parseFloat(values.raiseAmount.replace(/,/g, ''));
    if (isNaN(numericValue) || numericValue <= 0) {
      setFieldError('raiseAmount', t('createMission.raiseAmountInvalid'));
      return;
    }

    dispatch(showLoader());

    const profileType = await AsyncStorage.getItem('profile');

    const payload = {
      caption: caption.trim(),
      taggedPeople: taggedPeopleIds,
      // ...(Array.isArray(taggedPeopleIds) && taggedPeopleIds.length
      //   ? {
      //       taggedPeople: taggedPeopleIds,
      //       taggedPeopleIds,
      //     }
      //   : {
      //       taggedPeople: Array.isArray(taggedPeople) ? taggedPeople.join(', ') : taggedPeople,
      //     }),
      // ...(Array.isArray(taggedPeopleMeta) && taggedPeopleMeta.length
      //   ? { taggedPeopleMeta }
      //   : {}),
      media: images.map(img => ({
        uri: img.processedUri || img.uri,
        type: img.type,
        name: (img.processedUri || img.uri).split('/').pop()
      })),
      link: link ? link.trim() : '',
      type: profileType === 'company' ? 'support' : 'crowdfunding',
      raiseAmount: numericValue,
      start_time: formatDateTime(values.startTime),
      end_time: formatEndDateTime(values.endTime)
    };

    try {
      const response = await createPost(payload);

      if (response.statusCode == 200) {
        showToastMessage(toast, 'success', t('createMission.postCreatedSuccess'));
        resetForm();
        setShowPicker(false);
        setPickerMode('start');
        setActiveField(null);
        setShowCountryPicker(false);
        setSelectedCountry(null);
        setInitialCurrency('USD');
        navigation.navigate('HomeMain');
      } else {
        showToastMessage(toast, 'danger', response.message || t('createMission.postCreatedFail'));
      }
    } catch (err) {
      console.error('Post creation error:', err);
      showToastMessage(toast, 'danger', err.response?.message || t('createMission.postCreatedError'));
    } finally {
      dispatch(hideLoader());
    }
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('createMission.screenTitle')}</Text>
        <Text></Text>
      </View>

      <Formik
        initialValues={{
          raiseAmount: '',
          startTime: null,
          endTime: null,
          currency: selectedCountry ? getCurrencyInfo(selectedCountry.cca2).code : initialCurrency,
        }}
        enableReinitialize={true}
        validationSchema={validationSchema}
        validateOnChange={true}
        validateOnBlur={true}
        onSubmit={handlePost}
      >
        {({ handleBlur, handleSubmit, setFieldValue, setFieldTouched, resetForm, values, errors, touched }) => (
          <>
            <ScrollView style={[styles.content, bgStyle]} showsVerticalScrollIndicator={false}>
              {/* Raise Amount */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('createMission.raiseAmountLabel')}</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>
                    {selectedCountry ? getCurrencyInfo(selectedCountry.cca2).symbol : '$'}
                  </Text>
                  <TextInput
                    style={[styles.amountInput, touched.raiseAmount && errors.raiseAmount && styles.inputError]}
                    placeholder={t('createMission.raiseAmountPlaceholder')}
                    keyboardType="numeric"
                    value={values.raiseAmount}
                    onChangeText={(text) => handleAmountChange(text, setFieldValue)}
                    onBlur={handleBlur('raiseAmount')}
                    placeholderTextColor="#999"
                  />
                </View>
                {touched.raiseAmount && errors.raiseAmount && (
                  <Text style={styles.errorText}>{errors.raiseAmount}</Text>
                )}
              </View>

              {/* Start Time */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('createMission.startDateLabel')}</Text>
                <TouchableOpacity
                  style={[
                    styles.dateButton,
                    touched.startTime && errors.startTime && styles.inputError
                  ]}
                  onPress={() => showDatePicker('start', setFieldValue, setFieldTouched)}
                >
                  <Text style={[styles.dateText, !values.startTime && styles.placeholderText]}>
                    {values.startTime ? formatDateDisplay(values.startTime) : t('createMission.startDatePlaceholder')}
                  </Text>
                  <Icon name="calendar-outline" size={20} color="#666" />
                </TouchableOpacity>
                {touched.startTime && errors.startTime && (
                  <Text style={styles.errorText}>{errors.startTime}</Text>
                )}
              </View>

              {/* End Time */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('createMission.endDateLabel')}</Text>
                <TouchableOpacity
                  style={[
                    styles.dateButton,
                    touched.endTime && errors.endTime && styles.inputError
                  ]}
                  onPress={() => showDatePicker('end', setFieldValue, setFieldTouched)}
                >
                  <Text style={[styles.dateText, !values.endTime && styles.placeholderText]}>
                    {values.endTime ? formatDateDisplay(values.endTime) : t('createMission.endDatePlaceholder')}
                  </Text>
                  <Icon name="calendar-outline" size={20} color="#666" />
                </TouchableOpacity>
                {touched.endTime && errors.endTime && (
                  <Text style={styles.errorText}>{errors.endTime}</Text>
                )}
              </View>

              {/* Date Picker Modal */}
              <DatePicker
                modal
                open={showPicker}
                date={
                  pickerMode === 'start' && values.startTime
                    ? values.startTime
                    : pickerMode === 'end' && values.endTime
                      ? values.endTime
                      : new Date()
                }
                mode="date"
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                minimumDate={new Date()}
              />

              {/* Country Picker Modal */}
              <CountryPicker
                visible={showCountryPicker}
                onSelect={(country) => onSelectCountry(country, setFieldValue)}
                onClose={() => setShowCountryPicker(false)}
                withFilter
                withFlag
                withCurrency
                withCallingCode
                containerButtonStyle={styles.countryPicker}
              />
            </ScrollView>

            <CustomButton
              title={t('createMission.continueButton')}
              onPress={handleSubmit}
              style={[styles.socialBtn, styles.instagramBtn, { backgroundColor: text, borderColor: text }]}
              textStyle={styles.socialBtnText}
            />
          </>
        )}
      </Formik>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 80,
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 30
  },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  title: { fontSize: 18, fontWeight: '600', color: '#000', textAlign: 'center' },
  inputContainer: { marginBottom: 18 },
  label: { fontSize: 14, color: '#000', marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ff4444',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
  },
  currencyButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
  },
  currencyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flagContainer: {
    marginRight: 8,
  },
  currencyText: {
    flex: 1,
    color: '#333',
    fontSize: 16,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    padding: 10,
    fontSize: 16,
    color: '#333',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: { color: '#333', fontSize: 16 },
  socialBtn: {
    width: '90%',
    height: 45,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    bottom: 10,
  },
  socialBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  instagramBtn: {
    color: '#fff',
    borderWidth: 1,
    marginLeft: 20
  },
  countryPicker: {
    display: 'none',
  },
  placeholderText: {
    color: '#999',
  },
});

export default CreateMission;
