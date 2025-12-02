import React from 'react';
import { Modal, Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
 
const NotificationModal = ({ visible, message, closeModal }) => {

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={closeModal}
        >
            <View style={styles.modal_mainView}>
                <View
                    style={styles.modal_innerView}>
                        <View style={{marginVertical: 30}}>
                    <Icon name="notifications-sharp" size={28} color={'#5a2d82'}/>
                        </View>
                    <View style={styles.width_80}>
                        <Text style={styles.modal_msg}>{message}</Text>
                    </View>
                    <TouchableOpacity onPress={closeModal} style={[styles.modal_btnView, {backgroundColor: '#5a2d82'} ]}>
                        <Text style={styles.btnTxt}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modal_mainView: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.4)',
      zIndex: 1
   },
   modal_innerView: {
      alignItems: 'center',
      backgroundColor: '#fff',
      width: '80%',
      borderRadius: 40,
   },
   modal_msg:{
      color: 'black',
      fontSize: 16,
      textAlign:'center'
   },
   modal_btnView:{
      borderRadius: 18,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      width: '75%',
      marginVertical: 40
   },
   btnTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500'
   }
});
 
export default NotificationModal;