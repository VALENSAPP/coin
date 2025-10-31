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
import { Eyeopen, Eyeclosed, Metamask, LogoIcon } from '../../assets/icons';
import { useDispatch } from 'react-redux';
import { changePassword } from '../../../services/auth'; // Adjust import path as needed
import { Formik } from 'formik';
import * as Yup from 'yup';
import CustomButton from '../../components/customButton/customButton';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { userChangePassword } from '../../services/wallet';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../components/displaytoastmessage';

// Validation Schema
const validationSchema = Yup.object().shape({
    oldPassword: Yup.string()
        .required('Old password is required')
        .min(6, 'Password must be at least 6 characters'),
    newPassword: Yup.string()
        .required('New password is required')
        .min(6, 'Password must be at least 6 characters')
        .notOneOf([Yup.ref('oldPassword')], 'New password must be different from old password')
        .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
        .matches(/\d/, 'Password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
    confirmPassword: Yup.string()
        .required('Please confirm your new password')
        .oneOf([Yup.ref('newPassword')], 'Passwords must match'),
});

const ChangePassword = () => {
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const navigation = useNavigation();
    const dispatch = useDispatch();
    const toast = useToast();

    const handleChangePassword = async (values, { setFieldError, setFieldTouched }) => {
        // Mark all fields as touched to show errors
        setFieldTouched('oldPassword', true);
        setFieldTouched('newPassword', true);
        setFieldTouched('confirmPassword', true);

        // Check if all required fields are present
        if (!values.oldPassword || !values.newPassword || !values.confirmPassword) {
            if (!values.oldPassword) setFieldError('oldPassword', 'Old password is required');
            if (!values.newPassword) setFieldError('newPassword', 'New password is required');
            if (!values.confirmPassword) setFieldError('confirmPassword', 'Please confirm your new password');
            return;
        }

        dispatch(showLoader());
        const payload = {
            oldPassword: values.oldPassword,
            newPassword: values.newPassword,
        };
        console.log('Payload for password change:', payload);

        try {
            const response = await userChangePassword(payload);
            console.log('Password change response:', response);

            if (response.statusCode == 200) {
                showToastMessage(toast, 'success', response.message || 'Password changed successfully');
                navigation.goBack();
            } else {
                console.log('Password change error:', response);
                showToastMessage(toast, 'danger', response.message || 'Please try again');
            }
        } catch (err) {
            console.error('Password change error:', err);
            setFieldError('oldPassword', err.response?.message || 'An error occurred');
        } finally {
            dispatch(hideLoader());
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            {/* <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.title}>Change Password</Text>
                <Text></Text>
            </View> */}

            <Formik
                initialValues={{
                    oldPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                }}
                validationSchema={validationSchema}
                validateOnChange={true}
                validateOnBlur={true}
                onSubmit={handleChangePassword}>
                {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
                    <>
                        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                            {/* Old Password */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Old Password</Text>
                                <View style={styles.passwordInputContainer}>
                                    <TextInput
                                        style={[
                                            styles.passwordInput,
                                            touched.oldPassword && errors.oldPassword && styles.inputError,
                                        ]}
                                        placeholder="Enter old password"
                                        secureTextEntry={!showOldPassword}
                                        value={values.oldPassword}
                                        onChangeText={handleChange('oldPassword')}
                                        onBlur={handleBlur('oldPassword')}
                                        placeholderTextColor={"#4a4646ff"}
                                    />
                                    <TouchableOpacity
                                        style={styles.eyeIcon}
                                        onPress={() => setShowOldPassword(!showOldPassword)}>
                                        {showOldPassword ? <Eyeopen /> : <Eyeclosed />}
                                    </TouchableOpacity>
                                </View>
                                {touched.oldPassword && errors.oldPassword && (
                                    <Text style={styles.errorText}>{errors.oldPassword}</Text>
                                )}
                            </View>

                            {/* New Password */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>New Password</Text>
                                <View style={styles.passwordInputContainer}>
                                    <TextInput
                                        style={[
                                            styles.passwordInput,
                                            touched.newPassword && errors.newPassword && styles.inputError,
                                        ]}
                                        placeholder="Enter new password"
                                        secureTextEntry={!showNewPassword}
                                        value={values.newPassword}
                                        onChangeText={handleChange('newPassword')}
                                        onBlur={handleBlur('newPassword')}
                                        placeholderTextColor={"#4a4646ff"}
                                    />
                                    <TouchableOpacity
                                        style={styles.eyeIcon}
                                        onPress={() => setShowNewPassword(!showNewPassword)}>
                                        {showNewPassword ? <Eyeopen /> : <Eyeclosed />}
                                    </TouchableOpacity>
                                </View>
                                {touched.newPassword && errors.newPassword && (
                                    <Text style={styles.errorText}>{errors.newPassword}</Text>
                                )}
                            </View>

                            {/* Confirm Password */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Confirm New Password</Text>
                                <View style={styles.passwordInputContainer}>
                                    <TextInput
                                        style={[
                                            styles.passwordInput,
                                            touched.confirmPassword && errors.confirmPassword && styles.inputError,
                                        ]}
                                        placeholder="Confirm new password"
                                        secureTextEntry={!showConfirmPassword}
                                        value={values.confirmPassword}
                                        onChangeText={handleChange('confirmPassword')}
                                        onBlur={handleBlur('confirmPassword')}
                                        placeholderTextColor={"#4a4646ff"}
                                    />
                                    <TouchableOpacity
                                        style={styles.eyeIcon}
                                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                        {showConfirmPassword ? <Eyeopen /> : <Eyeclosed />}
                                    </TouchableOpacity>
                                </View>
                                {touched.confirmPassword && errors.confirmPassword && (
                                    <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                                )}
                            </View>
                        </ScrollView>

                        <CustomButton
                            title="Change Password"
                            onPress={handleSubmit}
                            style={[styles.socialBtn, styles.submitBtn]}
                            textStyle={styles.socialBtnText}
                        />
                    </>
                )}
            </Formik>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f2fd', paddingBottom: 50,
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
        backgroundColor: '#f8f2fd',
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
        backgroundColor: '#5a2d82',
        color: '#fff',
        borderWidth: 1,
        borderColor: '#5a2d82',
        marginLeft: 20,
    },
});

export default ChangePassword;