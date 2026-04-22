import React from "react";
import {
    View,
    Text,
    SafeAreaView,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import createStyles from "./Style";
import { AuthHeader } from "../../../components/auth";

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Animated Background
const AnimatedBackground = () => {
    const floatAnim1 = useSharedValue(0);
    const floatAnim2 = useSharedValue(0);
    const floatAnim3 = useSharedValue(0);

    React.useEffect(() => {
        floatAnim1.value = withTiming(1, { duration: 6000 });
        floatAnim2.value = withTiming(1, { duration: 8000 });
        floatAnim3.value = withTiming(1, { duration: 7000 });
    }, []);

    const style1 = useAnimatedStyle(() => ({
        transform: [{ translateY: floatAnim1.value * 30 - 15 }],
    }));

    const style2 = useAnimatedStyle(() => ({
        transform: [{ translateY: floatAnim2.value * 40 - 20 }],
    }));

    const style3 = useAnimatedStyle(() => ({
        transform: [{ translateY: floatAnim3.value * 35 - 17.5 }],
    }));

    return (
        <>
            <AnimatedView
                style={[
                    {
                        position: "absolute",
                        top: "-10%",
                        right: "-5%",
                        width: 300,
                        height: 300,
                        borderRadius: 150,
                        backgroundColor: "#5a2d82",
                        opacity: 0.08,
                    },
                    style1,
                ]}
            />
            <AnimatedView
                style={[
                    {
                        position: "absolute",
                        bottom: "5%",
                        left: "-10%",
                        width: 250,
                        height: 250,
                        borderRadius: 125,
                        backgroundColor: "#5a2d82",
                        opacity: 0.06,
                    },
                    style2,
                ]}
            />
            <AnimatedView
                style={[
                    {
                        position: "absolute",
                        top: "30%",
                        right: "-15%",
                        width: 200,
                        height: 400,
                        backgroundColor: "#5a2d82",
                        opacity: 0.04,
                        borderRadius: 100,
                    },
                    style3,
                ]}
            />
        </>
    );
};

// Account Card
const AccountCard = ({ isPurple, onPress }) => {
    const scaleAnim = useSharedValue(1);

    const handlePressIn = () => {
        scaleAnim.value = withSpring(0.96);
    };

    const handlePressOut = () => {
        scaleAnim.value = withSpring(1);
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleAnim.value }],
    }));

    const styles = createStyles();

    // ✅ Updated Features
    const personaFeatures = [
        { icon: "heart-outline", label: "Support & Being Support" },
        { icon: "flash-outline", label: "Join Battles" },
        { icon: "shield-checkmark-outline", label: "Verified User" },
        { icon: "storefront-outline", label: "Creator Storefront" },
        { icon: "people-outline", label: "Fan Subscriptions" },
        { icon: "flag-outline", label: "Mission Posts" },
        { icon: "lock-closed-outline", label: "Private Circle Posts" },
    ];

    const businessFeatures = [
        { icon: "storefront-outline", label: "Create Shop" },
        { icon: "people-outline", label: "Support Community" },
        { icon: "rocket-outline", label: "Launch Missions" },
        { icon: "flash-outline", label: "Run Battles" },
        { icon: "shield-checkmark-outline", label: "Get Verified — KYC" },
        { icon: "lock-closed-outline", label: "VIP Private Posts" },
    ];

    const features = isPurple ? personaFeatures : businessFeatures;

    return (
        <AnimatedTouchable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.9}
            style={[styles.card, animatedStyle]}
        >
            <View>
                <View
                    style={[
                        styles.iconCircle,
                        isPurple ? styles.iconCirclePurple : styles.iconCircleGold,
                    ]}
                >
                    <Icon
                        name={isPurple ? "person-outline" : "briefcase-outline"}
                        size={28}
                        color={isPurple ? "#5a2d82" : "#B7791F"}
                    />
                </View>

                <Text style={isPurple ? styles.cardTitlePurple : styles.cardTitleGold}>
                    {isPurple ? "I'm a Persona" : "I'm a Business"}
                </Text>

                <Text style={styles.cardDesc}>
                    {isPurple
                        ? "Connect, support, join battles & missions"
                        : "Sell, launch, grow, and get verified"}
                </Text>

                {/* ✅ Features List */}
                <View style={{ marginTop: 0 }}>
                    {features.map((item, index) => (
                        <View key={index} style={styles.listItem}>
                            <Icon
                                name={item.icon}
                                size={16}
                                color={isPurple ? "#5a2d82" : "#B7791F"}
                            />
                            <Text style={styles.listText}>{item.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <TouchableOpacity
                onPress={onPress}
                style={isPurple ? styles.purpleBtn : styles.goldBtn}
            >
                <Text style={isPurple ? styles.purpleBtnText : styles.goldBtnText}>
                    {isPurple ? "Continue as Persona" : "Continue as Business"}
                </Text>
            </TouchableOpacity>
        </AnimatedTouchable>
    );
};

// Main Screen
const SelectAccountType = () => {
    const styles = createStyles();
    const { height } = Dimensions.get("window");
    const navigation = useNavigation();

    const handleCardPress = (accountType) => {
        const profile = accountType === "business" ? "company" : "user";
        navigation.navigate("Signup", { profile });
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" translucent />

            {/* Background */}
            <View style={styles.backgroundContainer}>
                <AnimatedBackground />
            </View>

            {/* Content */}
            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.contentContainer}>
                    <AuthHeader
                        subtitle="Social media just got an upgrade"
                        showBackButton={true}
                        headerHeight={height * 0.28}
                        fromsetAccountType={true}
                        onBackPress={() => navigation.goBack()}
                    />

                    <View style={styles.cardsContainer}>
                        <AccountCard
                            isPurple={true}
                            onPress={() => handleCardPress("persona")}
                        />
                        <AccountCard
                            isPurple={false}
                            onPress={() => handleCardPress("business")}
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default SelectAccountType;