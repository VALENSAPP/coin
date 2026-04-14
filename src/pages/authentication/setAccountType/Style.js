import { StyleSheet } from "react-native";
import { useAppTheme } from "../../../theme/useApptheme";

const createStyles = () => {
    const { bg } = useAppTheme();

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
            paddingTop: 30,
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
            backgroundColor: "#E0E0E0",
            padding: 8,
            borderRadius: 10,
        },
        title: {
            fontSize: 26,
            fontWeight: "700",
            color: "#5a2d82",
            marginTop: 10,
        },
        subtitle: {
            fontSize: 14,
            color: "#7E7E7E",
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
            backgroundColor: "#fff",
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
        },
        cardAnimated: {
            backgroundColor: "#fff",
            borderRadius: 20,
            overflow: "hidden",
        },
        cardGradientBorder: {
            padding: 1,
            borderRadius: 20,
        },
        iconCirclePurple: {
            backgroundColor: "#EFEAFE",
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
            color: "#5a2d82",
            fontSize: 16,
        },
        cardTitleGold: {
            textAlign: "center",
            marginTop: 10,
            fontWeight: "700",
            color: "#D3B683",
            fontSize: 16,
        },
        cardDesc: {
            textAlign: "center",
            fontSize: 12,
            color: "#000",
            marginVertical: 12,
        },
        listItem: {
            flexDirection: "row",
            alignItems: "center",
            marginVertical: 8,
            paddingVertical: 4,
        },
        listText: {
            marginLeft: 10,
            fontSize: 13,
            color: "#000",
            fontWeight: "500",
        },
        purpleBtn: {
            marginTop: 16,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: "rgba(90, 45, 130, 0.12)",
            borderWidth: 2,
            borderColor: "#5a2d82",
            overflow: "hidden",
        },

        purpleBtnText: {
            color: "#5a2d82",
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
            borderColor: "#D3B683",
            overflow: "hidden",
        },

        goldBtnText: {
            color: "#D3B683",
            fontWeight: "700",
            textAlign: "center",
            fontSize: 14,
        },
    });

    return styles;
};

export default createStyles;