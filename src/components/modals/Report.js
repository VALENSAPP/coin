import React, { useRef, useState, forwardRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";
import RBSheet from "react-native-raw-bottom-sheet";
import Icon from "react-native-vector-icons/Ionicons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ReportFlowScreen = forwardRef((props, ref) => {
  const reasonSheet = useRef(null);
  const confirmSheet = useRef(null);

  const [selectedReason, setSelectedReason] = useState(null);

  const reportReasons = [
    { id: 1, title: "It's spam", icon: "alert-circle" },
    { id: 2, title: "Nudity or sexual content", icon: "alert-circle" },
    { id: 3, title: "Hate speech or symbols", icon: "alert-circle" },
    { id: 4, title: "Violence or dangerous behaviour", icon: "alert-circle" },
    { id: 5, title: "False information", icon: "alert-circle" },
    { id: 6, title: "Bullying or harassment", icon: "alert-circle" },
    { id: 7, title: "Scam or fraud", icon: "alert-circle" },
  ];

  const handleSelectReason = (reason) => {
    setSelectedReason(reason);
    reasonSheet.current?.close();
    setTimeout(() => confirmSheet.current?.open(), 200);
  };

  const submitReport = () => {
    console.log("REPORT SUBMITTED:", selectedReason);

    confirmSheet.current?.close();
    setSelectedReason(null);

    alert("Thanks! Your report has been submitted.");
  };

  // Expose the open method via ref
  React.useImperativeHandle(ref, () => ({
    open: () => reasonSheet.current?.open(),
    close: () => reasonSheet.current?.close(),
  }));

  return (
    <>
      {/* 🔴 Sheet 1 - Select Reason */}
      <RBSheet
        ref={reasonSheet}
        height={480}
        openDuration={200}
        closeOnDragDown={true}
        customStyles={{
          container: styles.sheetContainer,
          overlay: { backgroundColor: "rgba(0,0,0,0.4)" },
        }}
      >
        <View style={styles.dragHandle} />
        <View style={styles.headerContainer}>
          <View style={styles.headerIcon}>
            <Icon name="flag" size={28} color="#5a2d82" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>Report This Content</Text>
            <Text style={styles.sheetSubtitle}>
              Help us understand why you're reporting this
            </Text>
          </View>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.reasonsContent}
        >
          {reportReasons.map((reason) => (
            <TouchableOpacity
              key={reason.id}
              style={styles.reasonItem}
              onPress={() => handleSelectReason(reason.title)}
            >
              <View style={styles.reasonIconWrapper}>
                <Icon name={reason.icon} size={20} color="#5a2d82" />
              </View>
              <Text style={styles.reasonText}>{reason.title}</Text>
              <Icon name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </RBSheet>

      {/* 🔵 Sheet 2 - Confirm Reason */}
      <RBSheet
        ref={confirmSheet}
        height={400}
        openDuration={200}
        closeOnDragDown={true}
        customStyles={{
          container: styles.sheetContainer,
          overlay: { backgroundColor: "rgba(0,0,0,0.4)" },
        }}
      >
        <View style={styles.dragHandle} />
        <View style={styles.confirmHeaderContainer}>
          <View style={styles.checkIconWrapper}>
            <Icon name="checkmark-circle" size={50} color="#5a2d82" />
          </View>
          <Text style={styles.confirmTitle}>Report This Content</Text>
          <Text style={styles.confirmSubtitle}>
            We take your feedback seriously
          </Text>
        </View>

        <View style={styles.confirmContentBox}>
          <Text style={styles.confirmLabel}>Reason for report:</Text>
          <Text style={styles.selectedReason}>{selectedReason}</Text>
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={submitReport}>
          <Icon name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.submitButtonText}>Submit Report</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={() => confirmSheet.current?.close()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </RBSheet>
    </>
  );
});

ReportFlowScreen.displayName = "ReportFlowScreen";

export default ReportFlowScreen;

const styles = StyleSheet.create({
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: "#FFFFFF",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#DDD",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },

  headerContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },

  headerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },

  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },

  sheetSubtitle: {
    fontSize: 13,
    color: "#999",
    marginTop: 2,
  },

  reasonsContent: {
    paddingBottom: 20,
  },

  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: "#F8F8F8",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },

  reasonIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  reasonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
    flex: 1,
  },

  confirmHeaderContainer: {
    alignItems: "center",
    marginBottom: 24,
  },

  checkIconWrapper: {
    marginBottom: 12,
  },

  confirmTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },

  confirmSubtitle: {
    fontSize: 13,
    color: "#999",
  },

  confirmContentBox: {
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
    borderLeftWidth: 4,
    borderLeftColor: "#5a2d82",
  },

  confirmLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  selectedReason: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },

  submitButton: {
    backgroundColor: "#5a2d82",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginBottom: 10,
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  submitButtonText: {
    fontSize: 15,
    color: "#fff",
    fontWeight: "700",
  },

  cancelButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
  },

  cancelButtonText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
});