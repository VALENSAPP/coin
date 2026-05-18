import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Eyeopen, Eyeclosed } from '../../assets/icons';
import { useDispatch } from 'react-redux';
import { Formik } from 'formik';
import * as Yup from 'yup';
import CustomButton from '../../components/customButton/customButton';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { userChangePassword } from '../../services/wallet';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

const ChangePassword = () => {
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const { bgStyle, textStyle, text } = useAppTheme();
    const navigation = useNavigation();
    const dispatch = useDispatch();
    const toast = useToast();
    const { t } = useLanguage();

    // Validation schema built from translations so Yup messages are localised
    const validationSchema = Yup.object().shape({
        oldPassword: Yup.string()
            .required(t('changePassword.validation.oldPasswordRequired'))
            .min(6, t('changePassword.validation.oldPasswordMin')),
        newPassword: Yup.string()
            .required(t('changePassword.validation.newPasswordRequired'))
            .min(6, t('changePassword.validation.newPasswordMin'))
            .notOneOf(
                [Yup.ref('oldPassword')],
                t('changePassword.validation.newPasswordSameAsOld'),
            )
            .matches(/[A-Z]/, t('changePassword.validation.newPasswordUppercase'))
            .matches(/[a-z]/, t('changePassword.validation.newPasswordLowercase'))
            .matches(/\d/, t('changePassword.validation.newPasswordNumber'))
            .matches(
                /[!@#$%^&*(),.?":{}|<>]/,
                t('changePassword.validation.newPasswordSpecial'),
            ),
        confirmPassword: Yup.string()
            .required(t('changePassword.validation.confirmPasswordRequired'))
            .oneOf(
                [Yup.ref('newPassword')],
                t('changePassword.validation.confirmPasswordMatch'),
            ),
    });

    const handleChangePassword = async (values, { setFieldError, setFieldTouched }) => {
        setFieldTouched('oldPassword', true);
        setFieldTouched('newPassword', true);
        setFieldTouched('confirmPassword', true);

        if (!values.oldPassword || !values.newPassword || !values.confirmPassword) {
            if (!values.oldPassword)
                setFieldError('oldPassword', t('changePassword.validation.oldPasswordRequired'));
            if (!values.newPassword)
                setFieldError('newPassword', t('changePassword.validation.newPasswordRequired'));
            if (!values.confirmPassword)
                setFieldError('confirmPassword', t('changePassword.validation.confirmPasswordRequired'));
            return;
        }

        dispatch(showLoader());
        const payload = {
            oldPassword: values.oldPassword,
            newPassword: values.newPassword,
        };

        try {
            const response = await userChangePassword(payload);

            if (response.statusCode == 200) {
                showToastMessage(
                    toast,
                    'success',
                    response.message || t('changePassword.successMessage'),
                );
                navigation.goBack();
            } else {
                showToastMessage(
                    toast,
                    'danger',
                    response.message || t('changePassword.errorFallback'),
                );
            }
        } catch (err) {
            console.error('Password change error:', err);
            setFieldError(
                'oldPassword',
                err.response?.message || t('changePassword.errorOccurred'),
            );
        } finally {
            dispatch(hideLoader());
        }
    };

    return (
        <SafeAreaView style={[styles.container, bgStyle]}>
            <Formik
                initialValues={{
                    oldPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                }}
                validationSchema={validationSchema}
                validateOnChange={true}
                validateOnBlur={true}
                onSubmit={handleChangePassword}
            >
                {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
                    <>
                        <ScrollView
                            style={[styles.content, bgStyle]}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Old Password */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>{t('changePassword.oldPasswordLabel')}</Text>
                                <View style={styles.passwordInputContainer}>
                                    <TextInput
                                        style={[
                                            styles.passwordInput,
                                            touched.oldPassword && errors.oldPassword && styles.inputError,
                                        ]}
                                        placeholder={t('changePassword.oldPasswordPlaceholder')}
                                        secureTextEntry={!showOldPassword}
                                        value={values.oldPassword}
                                        onChangeText={handleChange('oldPassword')}
                                        onBlur={handleBlur('oldPassword')}
                                        placeholderTextColor="#4a4646ff"
                                    />
                                    <TouchableOpacity
                                        style={styles.eyeIcon}
                                        onPress={() => setShowOldPassword(!showOldPassword)}
                                    >
                                        {showOldPassword ? <Eyeopen /> : <Eyeclosed />}
                                    </TouchableOpacity>
                                </View>
                                {touched.oldPassword && errors.oldPassword && (
                                    <Text style={styles.errorText}>{errors.oldPassword}</Text>
                                )}
                            </View>

                            {/* New Password */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>{t('changePassword.newPasswordLabel')}</Text>
                                <View style={styles.passwordInputContainer}>
                                    <TextInput
                                        style={[
                                            styles.passwordInput,
                                            touched.newPassword && errors.newPassword && styles.inputError,
                                        ]}
                                        placeholder={t('changePassword.newPasswordPlaceholder')}
                                        secureTextEntry={!showNewPassword}
                                        value={values.newPassword}
                                        onChangeText={handleChange('newPassword')}
                                        onBlur={handleBlur('newPassword')}
                                        placeholderTextColor="#4a4646ff"
                                    />
                                    <TouchableOpacity
                                        style={styles.eyeIcon}
                                        onPress={() => setShowNewPassword(!showNewPassword)}
                                    >
                                        {showNewPassword ? <Eyeopen /> : <Eyeclosed />}
                                    </TouchableOpacity>
                                </View>
                                {touched.newPassword && errors.newPassword && (
                                    <Text style={styles.errorText}>{errors.newPassword}</Text>
                                )}
                            </View>

                            {/* Confirm Password */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>{t('changePassword.confirmPasswordLabel')}</Text>
                                <View style={styles.passwordInputContainer}>
                                    <TextInput
                                        style={[
                                            styles.passwordInput,
                                            touched.confirmPassword &&
                                                errors.confirmPassword &&
                                                styles.inputError,
                                        ]}
                                        placeholder={t('changePassword.confirmPasswordPlaceholder')}
                                        secureTextEntry={!showConfirmPassword}
                                        value={values.confirmPassword}
                                        onChangeText={handleChange('confirmPassword')}
                                        onBlur={handleBlur('confirmPassword')}
                                        placeholderTextColor="#4a4646ff"
                                    />
                                    <TouchableOpacity
                                        style={styles.eyeIcon}
                                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? <Eyeopen /> : <Eyeclosed />}
                                    </TouchableOpacity>
                                </View>
                                {touched.confirmPassword && errors.confirmPassword && (
                                    <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                                )}
                            </View>
                        </ScrollView>

                        <CustomButton
                            title={t('changePassword.submitButton')}
                            onPress={handleSubmit}
                            style={[
                                styles.socialBtn,
                                styles.submitBtn,
                                { backgroundColor: text, borderColor: text },
                            ]}
                            textStyle={styles.socialBtnText}
                        />
                    </>
                )}
            </Formik>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingBottom: 50,
        marginBottom: Platform.OS == "ios" ? 70 : 0
     },
    header: {
        height: 80,
        flexDirection: 'row',
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        paddingTop: 30,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000',
        textAlign: 'center',
    },
    inputContainer: { marginBottom: 18 },
    label: {
        fontSize: 14,
        color: '#000',
        marginBottom: 6,
        fontWeight: '500',
    },
    passwordInputContainer: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
    },
    passwordInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 10,
        padding: 10,
        paddingRight: 40,
        backgroundColor: '#fff',
    },
    eyeIcon: {
        position: 'absolute',
        right: 12,
        padding: 5,
    },
    inputError: {
        borderColor: '#ff4444',
    },
    errorText: {
        color: '#ff4444',
        fontSize: 12,
        marginTop: 4,
    },
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
    submitBtn: {
        color: '#fff',
        borderWidth: 1,
        marginLeft: 20,
    },
});

export default ChangePassword;