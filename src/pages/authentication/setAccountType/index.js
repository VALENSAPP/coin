import React, { useState, useRef } from "react";
import {
    View,
    Text,
    SafeAreaView,
    TouchableOpacity,
    Dimensions,
    StatusBar,
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

// Animated background decoration component
const AnimatedBackground = () => {
    const floatAnim1 = useSharedValue(0);
    const floatAnim2 = useSharedValue(0);
    const floatAnim3 = useSharedValue(0);
    const rotateAnim = useSharedValue(0);

    React.useEffect(() => {
        floatAnim1.value = withTiming(1, { duration: 6000 });
        floatAnim2.value = withTiming(1, { duration: 8000 });
        floatAnim3.value = withTiming(1, { duration: 7000 });
        rotateAnim.value = withTiming(1, { duration: 10000 });
    }, []);

    const style1 = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: floatAnim1.value * 30 - 15,
            },
        ],
    }));

    const style2 = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: floatAnim2.value * 40 - 20,
            },
        ],
    }));

    const style3 = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: floatAnim3.value * 35 - 17.5,
            },
        ],
    }));

    return (
        <>
            {/* Floating Gradient Shapes */}
            <AnimatedView
                style={[
                    { position: "absolute", top: "-10%", right: "-5%", width: 300, height: 300, borderRadius: 150, backgroundColor: "#5a2d82", opacity: 0.08 },
                    style1,
                ]}
            />
            <AnimatedView
                style={[
                    { position: "absolute", bottom: "5", left: "-10%", width: 250, height: 250, borderRadius: 125, backgroundColor: "#5a2d82", opacity: 0.06 },
                    style2,
                ]}
            />
            <AnimatedView
                style={[
                    { position: "absolute", top: "30%", right: "-15%", width: 200, height: 400, backgroundColor: "#5a2d82", opacity: 0.04, borderRadius: 100 },
                    style3,
                ]}
            />

            {/* Decorative Curved Lines - Bottom Right */}
            <View style={{ position: "absolute", bottom: 0, right: 0, width: "45%", height: "55%", overflow: "hidden" }}>
                <View
                    style={{
                        width: 300,
                        height: 300,
                        borderRadius: 150,
                        borderWidth: 2,
                        borderColor: "#5a2d82",
                        opacity: 0.05,
                        position: "absolute",
                        bottom: -80,
                        right: -80,
                    }}
                />
                <View
                    style={{
                        width: 250,
                        height: 250,
                        borderRadius: 125,
                        borderWidth: 1.5,
                        borderColor: "#D3B683",
                        opacity: 0.07,
                        position: "absolute",
                        bottom: -30,
                        right: -30,
                    }}
                />
            </View>
        </>
    );
};

// Interactive Card Component
const AccountCard = ({ isPurple, onPress }) => {
    const scaleAnim = useSharedValue(1);
    const shadowAnim = useSharedValue(0);

    const handlePressIn = () => {
        scaleAnim.value = withSpring(0.95);
        shadowAnim.value = withSpring(1);
    };

    const handlePressOut = () => {
        scaleAnim.value = withSpring(1);
        shadowAnim.value = withSpring(0);
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleAnim.value }],
        shadowOpacity: 0.12 + shadowAnim.value * 0.15,
    }));

    const styles = createStyles();

    return (
        <AnimatedTouchable
            // onPress={onPress}
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
                        ? "Connect, support,\njoin battles & missions"
                        : "Sell, launch, grow,\nand get verified"}
                </Text>

                <View style={styles.listItem}>
                    <Icon
                        name={isPurple ? "heart-outline" : "storefront-outline"}
                        size={16}
                        color={isPurple ? "#5a2d82" : "#B7791F"}
                    />
                    <Text style={styles.listText}>
                        {isPurple ? "Follow Creators" : "Create Shop"}
                    </Text>
                </View>

                <View style={styles.listItem}>
                    <Icon
                        name={isPurple ? "cube-outline" : "rocket-outline"}
                        size={16}
                        color={isPurple ? "#5a2d82" : "#B7791F"}
                    />
                    <Text style={styles.listText}>
                        {isPurple ? "Support Products" : "Launch Missions"}
                    </Text>
                </View>

                <View style={styles.listItem}>
                    <Icon
                        name="flash-outline"
                        size={16}
                        color={isPurple ? "#5a2d82" : "#B7791F"}
                    />
                    <Text style={styles.listText}>
                        {isPurple ? "Join Battles" : "Run Battles"}
                    </Text>
                </View>

                {!isPurple && (
                    <View style={styles.listItem}>
                        <Icon
                            name="shield-checkmark-outline"
                            size={16}
                            color="#B7791F"
                        />
                        <Text style={styles.listText}>Get Verified</Text>
                    </View>
                )}
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

const SelectAccountType = () => {
    const styles = createStyles();
    const { height } = Dimensions.get('window');
    const navigation = useNavigation();

    const handleCardPress = (accountType) => {
        const profile = accountType === 'business' ? 'company' : 'user';
        navigation.navigate('Signup', { profile });
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            
            {/* Animated Background */}
            <View style={styles.backgroundContainer}>
                <AnimatedBackground />
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
                {/* Enhanced Header */}
                <AuthHeader
                    subtitle="Social media just got an upgrade"
                    showBackButton={true}
                    headerHeight={height * 0.28}
                    fromsetAccountType={true}
                    onBackPress={() => navigation.goBack()}
                />

                {/* Cards */}
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
        </SafeAreaView>
    );
};

export default SelectAccountType;