import { StyleSheet } from 'react-native';
import Colors from './Colors';

const TextStyle = StyleSheet.create({
    mainheading: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.black
    },
    subheading: {
        color: Colors.black,
        fontSize: 16.5,
        fontWeight: "bold"
    },
    smallHeading: {
        color: Colors.black,
        fontSize: 12,
        fontWeight: '600',
    },
    title: {
        color: Colors.black,
        fontSize: 14,
        fontWeight: '600',
    },
    subTitle: {
        color: Colors.black,
        fontSize: 13,
        fontWeight: 'bold',
    },
    innertext: {
        color: Colors.black,
        fontWeight: '400',
        fontSize: 8
    },
    normaltext: {
        color: Colors.black,
        fontWeight: '400',
        fontSize: 13
    }
});

export default TextStyle;