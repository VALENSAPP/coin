import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    StyleSheet,
    Alert,
    PermissionsAndroid,
    Platform
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { PostStory } from '../../services/stories';
import { useToast } from 'react-native-toast-notifications';
import StoryComposer from '../../components/home/story.js/StoryComposer';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { getSubscriptionByUserID, setPrivateSubscription, setUserSubscription } from '../../services/wallet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAppTheme } from '../../theme/useApptheme';
import TermCondition from '../../components/modals/Term&Condition';

const SubventionSetupScreen = () => {
    const [price, setPrice] = useState('9');
    const [subscriptionId, setSubscriptionId] = useState(null);
    const [selectedTab, setSelectedTab] = useState('posts');
    const [showPrintWarning, setShowPrintWarning] = useState(false);
    const [printAttempts, setPrintAttempts] = useState(0);
    const [hasExistingSubscription, setHasExistingSubscription] = useState(false);
    const [isChecked, setIsChecked] = useState(false);
    const navigation = useNavigation();
    const toast = useToast();
    const dispatch = useDispatch();
    const { bgStyle, text } = useAppTheme();

    // Story composer state
    const [composerVisible, setComposerVisible] = useState(false);
    const [composerList, setComposerList] = useState([]);
    const [subscriptionAmount, setSubscriptionAmount] = useState(null);
    const [showModal, setShowModal] = useState(true);


    const contentTabs = [
        { id: 'posts', label: 'New Mint', icon: '📝' },
        { id: 'reels', label: 'Flips', icon: '🎬' },
        { id: 'stories', label: 'Drops', icon: '⭐' },
        { id: 'videos', label: 'Videos (10min)', icon: '🎥' }
    ];

    useFocusEffect(
        useCallback(() => {
            fetchSubscriptionByUserId();
        }, [])
    );

    const fetchSubscriptionByUserId = async () => {
        try {
            const id = await AsyncStorage.getItem('userId');
            dispatch(showLoader());
            const response = await getSubscriptionByUserID(id);
            console.log('getSubscriptionByUserID response:', response);

            if (response?.statusCode === 200) {
                const subscriptions = response?.data?.subscriptions;
                if (subscriptions && subscriptions.length > 0) {
                    const amount = subscriptions[0].subscriptionAmount;
                    const subId = subscriptions[0].id;
                    console.log("FIRST SUBSCRIPTION AMOUNT:", amount);
                    setSubscriptionAmount(amount);
                    setSubscriptionId(subId);
                    setPrice(amount.toString());
                    setHasExistingSubscription(true);
                    setShowModal(false)
                } else {
                    console.log("No subscriptions found");
                    setSubscriptionAmount(null);
                    setSubscriptionId(null);
                    setHasExistingSubscription(false);
                    setShowModal(true)
                }
            } else {
                showToastMessage(toast, 'danger', response.data.message);
                setHasExistingSubscription(false);
            }

        } catch (error) {
            console.error('Error fetching subscription:', error);
            showToastMessage(toast, 'danger', 'Something went wrong! Please try again');
            setHasExistingSubscription(false);
        }
        finally {
            dispatch(hideLoader());
        }
    };

    const handlePriceChange = (text) => {
        if (text === '' || /^\d*\.?\d{0,2}$/.test(text)) {
            setPrice(text);
        }
    };

    const handlePriceBlur = () => {
        // Apply min/max validation only when user finishes editing
        const numValue = parseFloat(price) || 0;
        if (numValue < 9) {
            setPrice('9');
        } else if (numValue > 100) {
            setPrice('100');
        } else {
            setPrice(numValue.toString());
        }
    };

    const handlePrintAttempt = () => {
        const newAttempts = printAttempts + 1;
        setPrintAttempts(newAttempts);

        if (newAttempts >= 3) {
            Alert.alert(
                '🚫 Account Blocked',
                'Your account has been temporarily blocked for security review due to multiple unauthorized attempts.',
                [{ text: 'OK', style: 'destructive' }]
            );
        } else {
            setShowPrintWarning(true);
        }
    };

    // Camera permission request
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
        } catch (err) {
            console.warn(err);
            return false;
        }
    };

    // Open camera
    const openCamera = async () => {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
            Alert.alert(
                'Permission Denied',
                'Camera permission is required to take photos.',
            );
            return;
        }
        const options = {
            mediaType: 'mixed',
            includeBase64: false,
            maxHeight: 2000,
            maxWidth: 2000,
            includeExtra: true,
            presentationStyle: 'fullScreen',
        };
        launchCamera(options, response => {
            if (response?.didCancel) return;
            if (response?.errorCode) {
                Alert.alert(
                    'Camera error',
                    response.errorMessage || response.errorCode,
                );
                return;
            }
            handleMediaSelected(response);
        });
    };

    // Open gallery
    const openGallery = () => {
        const options = {
            mediaType: 'mixed',
            selectionLimit: 10,
            includeBase64: false,
            maxHeight: 2000,
            maxWidth: 2000,
        };
        launchImageLibrary(options, response => {
            if (response?.didCancel || response?.errorCode) return;
            const assets = response?.assets || [];
            if (!assets.length) return;

            const list = assets.map(a => ({
                uri: a.uri,
                type: a.type?.startsWith('video') ? 'video' : 'image',
                duration: a.duration ? a.duration * 1000 : undefined,
            }));
            setComposerList(list);
            setComposerVisible(true);
        });
    };

    // Handle media selected from camera
    const handleMediaSelected = response => {
        const asset = response?.assets?.[0];
        if (!asset || !asset.uri) {
            Alert.alert('Oops', 'Could not read the selected media.');
            return;
        }
        const type = asset.type?.startsWith('video') ? 'video' : 'image';
        const list = [{
            uri: asset.uri,
            type: type,
            duration: type === 'video'
                ? (asset.duration ? asset.duration * 1000 : 15000)
                : 5000,
        }];
        setComposerList(list);
        setComposerVisible(true);
    };

    // Handle add story
    const handleAddStory = () => {
        Alert.alert('Add Story', 'Choose how to add your story', [
            { text: 'Camera', onPress: () => openCamera() },
            { text: 'Gallery', onPress: () => openGallery() },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    // Handle composer done
    const handleComposerDone = async (processedArray) => {
        try {
            setComposerVisible(false);

            // Prepare FormData for API call
            const formData = new FormData();

            // Add caption (optional)
            formData.append('caption', '');

            // Add media files
            processedArray.forEach((item, index) => {
                const fileUri = item.processedUri || item.original.uri;
                const fileName = `story_${Date.now()}_${index}.${item.isVideo ? 'mp4' : 'jpg'}`;
                const fileType = item.isVideo ? 'video/mp4' : 'image/jpeg';

                formData.append('media', {
                    uri: fileUri,
                    type: fileType,
                    name: fileName,
                });
            });

            // Call API to upload story
            const response = await PostStory(formData);

            if (response?.success) {
                showToastMessage(toast, 'success', 'Story Uploaded Successfully');
            } else {
                showToastMessage(toast, 'danger', 'Failed to upload story please try again');
            }
        } catch (error) {
            console.error('Error uploading story:', error);
            showToastMessage(toast, 'danger', 'Something Went Wrong! Please try again');
        }
    };

    const handleCreateContent = (contentType) => {
        // Handle different actions based on content type
        switch (contentType) {
            case 'posts':
                navigation.navigate('Add');
                break;
            case 'reels':
                // Navigate to create reel screen
                Alert.alert('Create Reel', 'Opening reel creator...');
                // Example: navigation.navigate('CreateReel');
                break;
            case 'stories':
                // Call handleAddStory for stories
                handleAddStory();
                break;
            case 'videos':
                // Navigate to create video screen
                Alert.alert('Create Video', 'Opening video creator (10min max)...');
                // Example: navigation.navigate('CreateVideo', { maxDuration: 600 });
                break;
            default:
                break;
        }
    };

    const PrintWarningModal = () => (
        <Modal
            visible={showPrintWarning}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowPrintWarning(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalIcon}>🚫</Text>
                    <Text style={styles.modalTitle}>No Print Allowed</Text>

                    <Text style={styles.modalText}>
                        This content is private and protected under Valens' Creator Rights.
                        Screenshots, prints, or downloads are not permitted.
                    </Text>

                    <View style={styles.warningBox}>
                        <Text style={styles.warningIcon}>⚠️</Text>
                        <Text style={styles.warningText}>
                            Warning: After 3 unauthorized attempts, your account will be
                            temporarily blocked for security review.
                        </Text>
                    </View>

                    <Text style={styles.footerText}>
                        Respect the creator. Respect the platform. 💜
                    </Text>

                    <TouchableOpacity
                        style={styles.understandButton}
                        onPress={() => setShowPrintWarning(false)}
                    >
                        <Text style={styles.understandButtonText}>I Understand</Text>
                    </TouchableOpacity>

                    <Text style={styles.attemptCounter}>
                        Attempts: {printAttempts}/3
                    </Text>
                </View>
            </View>
        </Modal>
    );

    const handleSaveSubscription = async () => {
        try {
            const subscriptionAmount = parseFloat(price) || 0;
            if (subscriptionAmount < 9 || subscriptionAmount > 100) {
                showToastMessage(toast, 'warning', 'Please enter a valid price between $9 and $100');
                return;
            }

            dispatch(showLoader());

            let response;

            // Check if there's existing subscription data
            if (hasExistingSubscription && subscriptionId) {
                const dataToSend = {
                    subscriptionAmount: subscriptionAmount,
                    status: "ACTIVE",
                    isDelete: 0
                };
                // Update existing subscription
                console.log('Updating existing subscription with ID:', subscriptionId);
                response = await setUserSubscription(dataToSend, subscriptionId);
            } else {
                const dataToSend = {
                    subscriptionAmount: subscriptionAmount,
                    status: "ACTIVE"
                };
                // Create new subscription
                console.log('Creating new subscription');
                response = await setPrivateSubscription(dataToSend);
            }

            console.log('Subscription response:', response);

            if (response?.statusCode === 200) {
                showToastMessage(toast, 'success', hasExistingSubscription ? 'Subscription updated successfully' : 'Subscription created successfully');
                // Refresh subscription data
                await fetchSubscriptionByUserId();
            } else {
                showToastMessage(toast, 'danger', response?.data?.message || 'Failed to save subscription');
            }

        } catch (error) {
            console.error('Error saving subscription:', error);
            showToastMessage(toast, 'danger', 'Something went wrong! Please try again');
        } finally {
            dispatch(hideLoader());
        }
    };

    return (
        <>
            <View style={{ flex: 1, paddingBottom: 20, }}>
                <ScrollView style={[styles.container, bgStyle]}>
                    {/* Price Setup Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>💰 Subscription Price</Text>
                        <Text style={styles.sectionSubtitle}>Set your monthly rate per subscriber</Text>

                        <View style={styles.priceInputContainer}>
                            <Text style={styles.currencySymbol}>$</Text>
                            <TextInput
                                style={styles.priceInput}
                                value={price}
                                onChangeText={handlePriceChange}
                                onBlur={handlePriceBlur}
                                keyboardType="numeric"
                            />
                            <Text style={styles.perMonth}>/month</Text>
                        </View>

                        <View style={styles.priceRange}>
                            <Text style={styles.rangeText}>Min: $9</Text>
                            <Text style={styles.rangeText}>Max: $100</Text>
                        </View>
                    </View>

                    {/* Content Creation Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📱 Create Content</Text>
                        <Text style={styles.sectionSubtitle}>
                            Full access to all content types
                        </Text>

                        <View style={styles.tabContainer}>
                            {contentTabs.map(tab => (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[
                                        styles.tab,
                                        selectedTab === tab.id && styles.tabActive
                                    ]}
                                    onPress={() => setSelectedTab(tab.id)}
                                >
                                    <Text style={styles.tabIcon}>{tab.icon}</Text>
                                    <Text style={[
                                        styles.tabLabel,
                                        selectedTab === tab.id && styles.tabLabelActive
                                    ]}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Content Creation Area */}
                        <View style={styles.contentArea}>
                            <Text style={styles.contentTitle}>
                                Create {contentTabs.find(t => t.id === selectedTab)?.label}
                            </Text>
                            <TouchableOpacity
                                style={styles.createButton}
                                onPress={() => handleCreateContent(selectedTab)}
                            >
                                <Text style={styles.createButtonText}>
                                    + New {contentTabs.find(t => t.id === selectedTab)?.label}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Subscriber Protection Info */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>🔒 Content Protection</Text>
                        <View style={styles.protectionItem}>
                            <Text style={styles.protectionIcon}>🚫</Text>
                            <Text style={styles.protectionText}>No prints allowed</Text>
                        </View>
                        <View style={styles.protectionItem}>
                            <Text style={styles.protectionIcon}>🚫</Text>
                            <Text style={styles.protectionText}>No downloads allowed</Text>
                        </View>
                        <View style={styles.protectionItem}>
                            <Text style={styles.protectionIcon}>🚫</Text>
                            <Text style={styles.protectionText}>No screenshots allowed</Text>
                        </View>
                        <View style={styles.protectionItem}>
                            <Text style={styles.protectionIcon}>⚠️</Text>
                            <Text style={styles.protectionText}>Auto-ban after 3 attempts</Text>
                        </View>
                    </View>

                    {/* Demo Button */}
                    <TouchableOpacity
                        style={styles.demoButton}
                        onPress={handlePrintAttempt}
                    >
                        <Text style={styles.demoButtonText}>
                            🧪 Demo: Trigger Print Warning
                        </Text>
                    </TouchableOpacity>

                    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                        <Text style={styles.heading}>VALENS MASTER SUBSCRIPTOR POLICY</Text>

                        <Text style={styles.sectionTitle}>1. Overview</Text>
                        <Text style={styles.text}>
                            This Master Subscription Policy applies to all users participating in the Valens
                            subscription ecosystem, including Plan Owners and Subscribers. By activating or subscribing,
                            users agree to this policy, including Valens Terms of Use, Privacy Policy, and Payout Policy.
                        </Text>

                        {/* PART A */}
                        <Text style={styles.partTitle}>PART A — TERMS FOR PLAN OWNERS</Text>

                        <Text style={styles.sectionTitle}>2. Subscription Plan Creation</Text>
                        <Text style={styles.text}>
                            When you activate a subscription plan, you become a Plan Owner. You may create private
                            channels, define perks, and set monthly subscription prices between $9.99 USD and $100.00 USD.
                        </Text>

                        <Text style={styles.sectionTitle}>3. Platform Fees</Text>
                        <Text style={styles.subSection}>3.1 Monthly Maintenance Fee</Text>
                        <Text style={styles.text}>
                            Valens charges $19.99 USD/month for hosting and operating your subscription channel.
                        </Text>

                        <Text style={styles.subSection}>3.2 Withdrawal Fee</Text>
                        <Text style={styles.text}>A 5% withdrawal fee applies to every payout request.</Text>

                        <Text style={styles.subSection}>3.3 Billing Authorization</Text>
                        <Text style={styles.text}>
                            By enabling your plan, you authorize Valens to charge maintenance fees and deduct payout
                            withdrawal fees automatically.
                        </Text>

                        <Text style={styles.sectionTitle}>4. Earnings & Payouts</Text>
                        <Text style={styles.text}>
                            Earnings are visible in the Creator Dashboard. Payouts follow the Payout Policy. KYC
                            verification is required. You must report earnings to tax authorities.
                        </Text>

                        <Text style={styles.sectionTitle}>5. Content Responsibilities</Text>
                        <Text style={styles.text}>
                            All private content must follow Valens guidelines. Illegal, harmful, abusive, or fraudulent
                            content is prohibited.
                        </Text>

                        <Text style={styles.sectionTitle}>6. Account & Compliance Enforcement</Text>
                        <Text style={styles.text}>
                            Valens may restrict monetization, freeze payouts, remove content, or disable plans upon
                            violations.
                        </Text>

                        {/* PART B */}
                        <Text style={styles.partTitle}>PART B — TERMS FOR SUBSCRIBERS</Text>

                        <Text style={styles.sectionTitle}>7. Subscription Access</Text>
                        <Text style={styles.text}>
                            Subscribers gain access to exclusive private content and perks. Access is non-transferable.
                        </Text>

                        <Text style={styles.sectionTitle}>8. Monthly Billing & Auto-Renewal</Text>
                        <Text style={styles.text}>
                            By subscribing, you authorize Valens to bill you monthly until cancellation.
                        </Text>

                        <Text style={styles.sectionTitle}>9. Cancellation</Text>
                        <Text style={styles.text}>
                            You may cancel anytime. Access remains until the end of the billing period. No partial refunds.
                        </Text>

                        <Text style={styles.sectionTitle}>10. No Refunds</Text>
                        <Text style={styles.text}>
                            All subscription payments are final and non-refundable, including unused periods.
                        </Text>

                        <Text style={styles.sectionTitle}>11. Content Protection</Text>
                        <Text style={styles.text}>
                            Subscribers may NOT screenshot, record, download, print, or share subscription content.
                            Violations may result in a security block.
                        </Text>

                        {/* PART C */}
                        <Text style={styles.partTitle}>PART C — GENERAL TERMS</Text>

                        <Text style={styles.sectionTitle}>12. Safety & Compliance</Text>
                        <Text style={styles.text}>
                            All interactions must comply with Valens Community Guidelines and legal requirements.
                        </Text>

                        <Text style={styles.sectionTitle}>13. Platform Rights</Text>
                        <Text style={styles.text}>
                            Valens may update fees, freeze suspicious activity, restrict payouts, or suspend programs.
                        </Text>

                        <Text style={styles.sectionTitle}>14. Agreement to Terms</Text>
                        <Text style={styles.text}>
                            By using subscription features, you agree to this policy and authorize Valens to manage
                            charges and fees.
                        </Text>

                        <View style={{ marginTop: 15 }} />

                        <TouchableOpacity
                            style={styles.checkboxRow}
                            onPress={() => setIsChecked(!isChecked)}
                        >
                            <Ionicons
                                name={isChecked ? "checkbox-outline" : "square-outline"}
                                size={26}
                                color={text}
                            />
                            <Text style={styles.checkboxLabel}>I agree to the Terms & Conditions</Text>
                        </TouchableOpacity>
                    </ScrollView>

                    <TouchableOpacity style={[styles.saveButton, !isChecked && { opacity: 0.5 }]} onPress={handleSaveSubscription} disabled={!isChecked}>
                        <Text style={styles.saveButtonText}>
                            {hasExistingSubscription ? 'Update Subscription' : 'Save & Activate Program'}
                        </Text>
                    </TouchableOpacity>

                    <PrintWarningModal />
                </ScrollView>

                {/* Story Composer Modal */}
                <StoryComposer
                    modalVisible={composerVisible}
                    mediaList={composerList}
                    onCancel={() => setComposerVisible(false)}
                    onDone={handleComposerDone}
                />
                <TermCondition
                    showModal={showModal}
                    setShowModal={setShowModal}
                    onAccept={handleSaveSubscription}
                />
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginBottom: 20,
    },
    section: {
        backgroundColor: '#fff',
        margin: 16,
        padding: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
    },
    priceInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 20,
    },
    currencySymbol: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#7c3aed',
        marginRight: 8,
    },
    priceInput: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#1f2937',
        borderBottomWidth: 3,
        borderBottomColor: '#7c3aed',
        minWidth: 100,
        textAlign: 'center',
        padding: 8,
    },
    perMonth: {
        fontSize: 18,
        color: '#6b7280',
        marginLeft: 8,
    },
    priceRange: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    rangeText: {
        fontSize: 14,
        color: '#6b7280',
    },
    tabContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    tab: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#f3f4f6',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    tabActive: {
        backgroundColor: '#ede9fe',
        borderColor: '#7c3aed',
    },
    tabIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    tabLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
    },
    tabLabelActive: {
        color: '#7c3aed',
    },
    contentArea: {
        backgroundColor: '#f9fafb',
        padding: 20,
        borderRadius: 8,
        alignItems: 'center',
    },
    contentTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 12,
    },
    createButton: {
        backgroundColor: '#7c3aed',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    createButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    protectionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    protectionIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    protectionText: {
        fontSize: 16,
        color: '#374151',
    },
    demoButton: {
        backgroundColor: '#f3f4f6',
        margin: 16,
        padding: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#d1d5db',
        borderStyle: 'dashed',
    },
    demoButtonText: {
        textAlign: 'center',
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#7c3aed',
        marginLeft: 16,
        marginRight: 16,
        paddingHorizontal: 18,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 40,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 30,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    modalIcon: {
        fontSize: 60,
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#dc2626',
        marginBottom: 16,
    },
    modalText: {
        fontSize: 16,
        color: '#374151',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 20,
    },
    warningBox: {
        backgroundColor: '#fef3c7',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#fbbf24',
    },
    warningIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    warningText: {
        flex: 1,
        fontSize: 14,
        color: '#92400e',
        lineHeight: 20,
    },
    footerText: {
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 24,
        textAlign: 'center',
    },
    understandButton: {
        backgroundColor: '#7c3aed',
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 12,
        width: '100%',
    },
    understandButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    attemptCounter: {
        marginTop: 16,
        fontSize: 14,
        color: '#dc2626',
        fontWeight: '600',
    },
    // term and condition style
    content: {
        paddingLeft: 15,
        paddingRight: 15,
    },
    heading: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 15,
        color: '#000000',
        textAlign: 'center',
    },
    partTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 10,
        marginBottom: 10,
        color: '#000000',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginTop: 7,
        marginBottom: 5,
        color: '#000000',
    },
    subSection: {
        fontSize: 15,
        fontWeight: '600',
        marginTop: 5,
        color: '#000000',
        marginBottom: 1,
    },
    text: {
        fontSize: 14,
        color: '#000000',
        lineHeight: 18,
    },
    checkboxRow: {
        flexDirection: "row",
        alignItems: "center",
    },

    checkboxLabel: {
        marginLeft: 10,
        fontSize: 16,
        color: "#333",
    },
});

export default SubventionSetupScreen;