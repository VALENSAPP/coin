import { StyleSheet, Platform } from "react-native";
import { useAppTheme } from "../../../theme/useApptheme";

const createStyles = () => {
    const { bg, text, card, border, mutedText, accent } = useAppTheme();

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: bg,
            overflow: "hidden",
        },
        backgroundContainer: {
            ...StyleSheet.absoluteFillObject,
            overflow: "hidden",
        },
        bgShape1: {
            position: "absolute",
            width: 300,
            height: 300,
            borderRadius: 150,
            opacity: 0.1,
        },
        bgShape2: {
            position: "absolute",
            width: 250,
            height: 250,
            borderRadius: 125,
            opacity: 0.08,
        },
        bgShape3: {
            position: "absolute",
            width: 200,
            height: 400,
            opacity: 0.06,
        },
        contentContainer: {
            flex: 1,
            ppaddingTop: Platform.OS === 'ios' ? 0 : 30,
            zIndex: 1,
        },
        header: {
            paddingTop: 20,
            paddingBottom: 40,
            alignItems: "center",
        },
        topIcon: {
            position: "absolute",
            left: 16,
            top: 10,
            backgroundColor: card,
            padding: 8,
            borderRadius: 10,
        },
        title: {
            fontSize: 26,
            fontWeight: "700",
            color: accent,
            marginTop: 10,
        },
        subtitle: {
            fontSize: 14,
            color: mutedText,
            marginTop: 5,
        },
        cardsContainer: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginHorizontal: 12,
            marginTop: 20,
            marginBottom: 20,
        },
        card: {
            flex: 1,
            backgroundColor: card,
            marginHorizontal: 6,
            borderRadius: 20,
            padding: 18,
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            flexDirection: "column",
            justifyContent: "space-between",
            borderWidth: 1,
            borderColor: border,
        },
        cardAnimated: {
            backgroundColor: card,
            borderRadius: 20,
            overflow: "hidden",
        },
        cardGradientBorder: {
            padding: 1,
            borderRadius: 20,
        },
        iconCirclePurple: {
            backgroundColor: `${accent}22`,
            padding: 10,
            borderRadius: 20,
            alignSelf: "center",
        },
        iconCircleGold: {
            backgroundColor: "#FFF4E5",
            padding: 10,
            borderRadius: 20,
            alignSelf: "center",
        },
        cardTitlePurple: {
            textAlign: "center",
            marginTop: 10,
            fontWeight: "700",
            color: accent,
            fontSize: 16,
        },
        cardTitleGold: {
            textAlign: "center",
            marginTop: 10,
            fontWeight: "700",
            color: "#C9A15a",
            fontSize: 16,
        },
        cardDesc: {
            textAlign: "center",
            fontSize: 12,
            color: mutedText,
            marginVertical: 12,
        },
        listItem: {
            flexDirection: "row",
            alignItems: "center",
            marginVertical: 4,
            paddingVertical: 4,
        },
        listText: {
            marginLeft: 10,
            fontSize: 13,
            color: text,
            fontWeight: "500",
        },
        purpleBtn: {
            marginTop: 16,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: `${accent}22`,
            borderWidth: 2,
            borderColor: accent,
            overflow: "hidden",
        },

        purpleBtnText: {
            color: accent,
            fontWeight: "700",
            textAlign: "center",
            fontSize: 14,
        },

        goldBtn: {
            marginTop: 16,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: "rgba(211, 182, 131, 0.18)",
            borderWidth: 2,
            borderColor: "#C9A15a",
            overflow: "hidden",
        },

        goldBtnText: {
            color: "#C9A15a",
            fontWeight: "700",
            textAlign: "center",
            fontSize: 14,
        },
    });

    return styles;
};

export default createStyles;
