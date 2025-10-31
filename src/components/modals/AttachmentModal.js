import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import createStyles from './Style';

const AttachmentModal = ({ visible, onClose, onSelect }) => {
    const styles = createStyles();

    return (
        <Modal
            animationType="fade"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.AttachmentModaloverlay} activeOpacity={1} onPress={onClose}>
                <View style={styles.attachmentmodalContainer}>
                    {['Photo', 'Video', 'File'].map((type) => (
                        <TouchableOpacity
                            key={type}
                            style={styles.AttachmentModaloption}
                            onPress={() => onSelect(type)}
                        >
                            <Text style={styles.AttachmentModaloptionText}>
                                {type}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

export default AttachmentModal;