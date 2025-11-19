import React from 'react';
import {
    SafeAreaView,
    ScrollView,
    View,
    Text,
    TouchableOpacity,
    Image,
    StyleSheet,
    Dimensions,
    Share,
    Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useAppTheme } from '../../theme/useApptheme';
 
const { width } = Dimensions.get('window');
 
export default function InviteScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { bgStyle, textStyle } = useAppTheme();
 
    // Generate unique referral code for this user
    const userReferralCode = route?.params?.referralCode ?? 'ABC123';
    
    // OPTION 1: Custom URL Scheme (works immediately)
    // Format: yourapp://referral?code=ABC123
    const deepLinkUrl = `https://we.tl/t-fcsDZN5ysU`;
    
    // OPTION 2: Universal Link (requires domain setup)
    // Format: https://yourdomain.com/referral?code=ABC123
    // const deepLinkUrl = `https://yourdomain.com/referral?code=${userReferralCode}`;
    
    const avatar = route?.params?.avatar;
 
    // sizing
    const qrSize = Math.min(width * 0.72, 320);
    const innerPadding = 14;
    const innerSize = qrSize + innerPadding;
    const avatarSize = 56;
    const avatarPos = (innerSize / 2) - (avatarSize / 2);
 
    const onShare = async () => {
        try {
            await Share.share({
                message: `Join Valens and earn rewards! Use my referral code: ${userReferralCode}\n\n${deepLinkUrl}`,
                url: deepLinkUrl,
                title: 'Join Valens',
            });
        } catch (e) {
            console.warn('Share error', e);
        }
    };

    const onCopyLink = () => {
        Clipboard.setString(deepLinkUrl);
        Alert.alert('Copied!', 'Referral link copied to clipboard');
    };
 
    return (
        <SafeAreaView style={[styles.safe, bgStyle]}>
            <ScrollView contentContainerStyle={styles.container}>
                {/* Back button */}
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        // paddingHorizontal: 5,
                    }}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={26} color="#666" />
                    </TouchableOpacity>

                    <Text style={styles.title}>Invite friends, earn Rewards</Text>

                    {/* Empty view to balance spacing on the right */}
                    <View style={{ width: 26 }} />
                </View>
                <Text style={styles.subtitle}>
                    For every friend you invite to Valens, you'll earn rewards for every trade. <Text style={{ fontWeight: '700' }}>Learn more.</Text>
                </Text>
 
                {/* QR with pastel gradient border */}
                <View style={{ height: 18 }} />
 
                <LinearGradient
                    colors={['#FAD9B6', '#C6F6D9', '#BEE8FF', '#F1C9F2']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.qrGradient, { width: innerSize + 16, height: innerSize + 16, borderRadius: 18 }]}
                >
                    <View style={[styles.qrInner, { width: innerSize, height: innerSize, borderRadius: 14 }]}>
                        <View style={{ width: qrSize, height: qrSize, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
                            {/* QR code now contains the deep link */}
                            <QRCode value={deepLinkUrl} size={qrSize * 0.94} />
                        </View>
 
                        {/* avatar overlay centered on top of QR */}
                        <View style={[styles.avatarWrapper, {
                            width: avatarSize,
                            height: avatarSize,
                            borderRadius: avatarSize / 2,
                            top: avatarPos,
                            left: avatarPos,
                        }]}>
                            <Image source={{ uri: avatar }} style={styles.avatar} />
                        </View>
                    </View>
                </LinearGradient>
 
                {/* Share row */}
                <View style={{ height: 22 }} />
                <View style={styles.shareRow}>
                    <TouchableOpacity style={styles.shareButton} onPress={onShare} activeOpacity={0.85}>
                        <Text style={styles.shareText}>Share your link</Text>
                    </TouchableOpacity>
 
                    <TouchableOpacity style={[styles.iconButton, bgStyle]} onPress={onCopyLink} activeOpacity={0.85}>
                        <Ionicons name="link-outline" size={22} color="#111" />
                    </TouchableOpacity>
                </View>
 
                {/* Bottom section */}
                <View style={{ height: 28 }} />
                <Text style={styles.sectionTitle}>Your invites</Text>
                <Text style={styles.sectionSubtitle}>Invite your first user to earn Sparks when their posts are minted.</Text>
 
                {/* Debug info (remove in production) */}
                <View style={styles.debugBox}>
                    <Text style={styles.debugText}>Referral Code: {userReferralCode}</Text>
                    <Text style={styles.debugText}>Deep Link: {deepLinkUrl}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
 
const styles = StyleSheet.create({
    safe: { flex: 1, marginTop: 20 },
    container: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 40,
    },
 
    backBtn: {
        position: 'absolute',
        // left: 16,
        // top: 27,
        zIndex: 10,
    },
 
    title: {
        // marginTop: 6,
        fontSize: 26,
        fontWeight: '700',
        textAlign: 'center',
        width: '85%',
        left: 10,
        color: '#111',
    },
    subtitle: {
        marginTop: 10,
        textAlign: 'center',
        color: '#666',
        lineHeight: 22,
        paddingHorizontal: 6,
    },
 
    qrGradient: {
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    qrInner: {
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 7,
    },
 
    avatarWrapper: {
        position: 'absolute',
        borderWidth: 3,
        borderColor: '#fff',
        overflow: 'hidden',
        backgroundColor: '#fff',
    },
    avatar: { width: '100%', height: '100%' },
 
    shareRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 2,
    },
    shareButton: {
        flex: 1,
        backgroundColor: '#111',
        paddingVertical: 14,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    shareText: { color: '#fff', fontSize: 16, fontWeight: '600' },
 
    iconButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
    },
 
    sectionTitle: {
        alignSelf: 'flex-start',
        fontSize: 20,
        fontWeight: '700',
        marginTop: 4,
        color: '#111',
    },
    sectionSubtitle: {
        alignSelf: 'flex-start',
        color: '#777',
        marginTop: 6,
        lineHeight: 22,
    },

    debugBox: {
        marginTop: 20,
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        width: '100%',
    },
    debugText: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
});