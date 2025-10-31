import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

export const showToastMessage = async (toast, type, text) => {
    try {
        if (!toast || typeof toast.show !== 'function') {
            console.warn('Toast object is not available or toast.show is not a function');
            return;
        }
        toast.show(
            <View style={styles.toastContent}>
                <Text style={styles.text}>{text}</Text>
            </View>,
            {
                type: type,
                placement: 'top',
                animationType: 'zoom-in',
                swipeEnabled: true,
                duration: 2500, 
                style: styles.toastContainer,
                onPress: () => {
                    toast.hide();
                },
            }
        );
    } catch (error) {
        console.error('Error in toaster:', error);
    }
};

const styles = StyleSheet.create({
    text: {
        color: 'white',
        fontSize: 16,
        marginLeft: 8,
    },
    toastContainer: {
        alignSelf: 'flex-end',
        marginRight: 20,
    },
    toastContent: {
        flexDirection: 'row',
        alignItems: 'center',
        // padding: 20,
    },
});
