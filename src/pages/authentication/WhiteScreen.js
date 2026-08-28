import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import TextGradient from '../../assets/textgradient/TextGradient';
import { Chat, LogoIcon } from '../../assets/icons';
import { useLanguage } from '../../i18n';
import { useAppTheme } from '../../theme/useApptheme';
import { SafeAreaView } from 'react-native-safe-area-context';

const WhiteScreen = () => {
    const { t } = useLanguage();
    const { bg, text } = useAppTheme();
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const blink = Animated.loop(
            Animated.sequence([
                Animated.timing(fadeAnim, {
                    toValue: 0.2,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );

        blink.start();

        return () => blink.stop();
    }, []);
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
            <View style={styles.header}>
                <Animated.View style={{ opacity: fadeAnim }}>
                    <TouchableOpacity style={styles.headerLeft} >
                        <LogoIcon height={60} width={60} />
                        <TextGradient
                            style={{ fontWeight: 'bold', fontSize: 30 }}
                            locations={[0, 1]}
                            colors={['#513189bd', '#e54ba0']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            text={t('home.appTitle')}
                        />
                    </TouchableOpacity>
                </Animated.View>
                {/* <View style={styles.headerIcons}> */}
                {/* <TouchableOpacity
                        style={styles.iconButton}
                        accessibilityLabel={t('home.notificationsLabel')}
                    >
                        <Icon name="notifications-outline" size={25} color="#111100" />
                        <View style={styles.badgeContainer}>
                            <Text style={styles.badgeText}>
                            </Text>
                        </View>
                        {/* )} */}
                {/* </TouchableOpacity>  */}

                {/* <TouchableOpacity
                        accessibilityLabel={t('home.chatLabel')}
                        style={styles.iconButton}
                    >
                        <Chat width={24} height={24} />
                        <View style={styles.badgeContainer}>
                            <Text style={styles.badgeText}>
                            </Text>
                        </View>
                    </TouchableOpacity> */}

                {/* <TouchableOpacity
                        accessibilityLabel={sidebarVisible ? t('home.storiesCloseLabel') : t('home.storiesOpenLabel')}
                        style={sidebarStyles.toggleButton}
                    >
                        <Icon
                            name={sidebarVisible ? "chevron-forward" : "chevron-back"}
                            size={24}
                            color={text}
                        />
                    </TouchableOpacity> */}
                {/* </View> */}
            </View>
        </SafeAreaView>

    );
};

export default WhiteScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: -13,
    },
    header: {
        // flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    appLogo: {
        resizeMode: 'contain',
    },
    logo: {
        fontFamily: 'Nunito-SemiBold',
        fontSize: 22,
        fontWeight: '700',
        color: '#4d2a88',
        marginTop: 10,
        marginLeft: -2
    },
    headerIcons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: {
        marginLeft: 20,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 18,
        color: '#666',
    },
    iconButton: {
        position: 'relative',
        padding: 4,
        marginLeft: 16,
    },
    badgeContainer: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 18,
        height: 18,
        borderRadius: 9,
        // backgroundColor: '#FF3B30',
        // alignItems: 'center',
        // justifyContent: 'center',
        // borderWidth: 1.5,
        // borderColor: '#fff',
        // zIndex: 999,
        // elevation: 5,
    },

    badgeText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: '700',
        textAlign: 'center',
        includeFontPadding: false,
    },
});