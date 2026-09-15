import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useLanguage } from '../../i18n';
import { useAppTheme } from '../../theme/useApptheme';

const RegularSubscriptionPrompt = ({ visible, onLearnMore, onLater }) => {
  const { t } = useLanguage();
  const { cardStyle, textStyle, text ,bgStyle} = useAppTheme();

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={[styles.modalCard, cardStyle]}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onLater}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={22} color="#6B7280" />
        </TouchableOpacity>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header Crown Graphic */}
          <View style={styles.crownContainer}>
            <View style={styles.sparkleLeft}>
              <MaterialCommunityIcons name="star-four-points" size={16} color={text} />
            </View>
            <View style={styles.sparkleTopLeft}>
              <MaterialCommunityIcons name="star-four-points" size={12} color={text}/>
            </View>
            <View style={styles.sparkleRight}>
              <MaterialCommunityIcons name="star-four-points" size={18} color={text} />
            </View>
            <View style={styles.sparkleTopRight}>
              <MaterialCommunityIcons name="star-four-points" size={14} color={text} />
            </View>

            <MaterialCommunityIcons name="crown" size={54} color={text}/>
            <View style={[styles.valensBanner, { backgroundColor: text }]}>
              <Text style={styles.valensBannerText}>VALENS</Text>
            </View>
          </View>

          {/* Title & Subtitle */}
          <Text style={[styles.title, textStyle]}>
            {t('regularSubscriptionPrompt.titlePrefix')}
            <Text style={[styles.titleHighlight, textStyle]}>
              {t('regularSubscriptionPrompt.titleHighlight')}
            </Text>
          </Text>

          <Text style={[styles.subtitle, { color: text }]}>
            {t('regularSubscriptionPrompt.subtitle')}
          </Text>

          {/* Premium Container Card */}
          <View style={[styles.premiumCard, bgStyle]}>
            <View style={styles.premiumHeaderRow}>
              <MaterialCommunityIcons name="crown" size={24} color={text} style={styles.headerCrownIcon} />
              <View style={styles.premiumHeaderTexts}>
                <Text style={[styles.premiumTitle, { color: text }]}>
                  {t('regularSubscriptionPrompt.premiumTitle')}
                </Text>
                <Text style={[styles.premiumSub, { color: text }]}>
                  {t('regularSubscriptionPrompt.premiumSub')}
                </Text>
              </View>
            </View>

            {/* Feature List */}
            <View style={styles.featureList}>
              {/* Feature 1 */}
              <View style={styles.featureRow}>
                <View style={[styles.featureIconBadge, {backgroundColor: `${text}28`}]}>
                  <MaterialCommunityIcons name="target" size={18} color={text} />
                </View>
                <View style={styles.featureTexts}>
                  <Text style={styles.featureTitle}>
                    {t('regularSubscriptionPrompt.feature1Title')}
                  </Text>
                  <Text style={styles.featureSub}>
                    {t('regularSubscriptionPrompt.feature1Sub')}
                  </Text>
                </View>
              </View>

              {/* Feature 2 */}
              <View style={styles.featureRow}>
                <View style={[styles.featureIconBadge, {backgroundColor: `${text}28`}]}>
                  <MaterialCommunityIcons name="crown" size={18} color={text} />
                </View>
                <View style={styles.featureTexts}>
                  <Text style={styles.featureTitle}>
                    {t('regularSubscriptionPrompt.feature2Title')}
                  </Text>
                  <Text style={styles.featureSub}>
                    {t('regularSubscriptionPrompt.feature2Sub')}
                  </Text>
                </View>
              </View>

              {/* Feature 3 */}
              <View style={styles.featureRow}>
                <View style={[styles.featureIconBadge, {backgroundColor: `${text}28`}]}>
                  <MaterialCommunityIcons name="star" size={18} color={text} />
                </View>
                <View style={styles.featureTexts}>
                  <Text style={styles.featureTitle}>
                    {t('regularSubscriptionPrompt.feature3Title')}
                  </Text>
                  <Text style={styles.featureSub}>
                    {t('regularSubscriptionPrompt.feature3Sub')}
                  </Text>
                </View>
              </View>

              {/* Feature 4 */}
              <View style={styles.featureRow}>
                <View style={[styles.featureIconBadge, {backgroundColor: `${text}28`}]}>
                  <MaterialCommunityIcons name="poll" size={18} color={text} />
                </View>
                <View style={styles.featureTexts}>
                  <Text style={styles.featureTitle}>
                    {t('regularSubscriptionPrompt.feature4Title')}
                  </Text>
                  <Text style={styles.featureSub}>
                    {t('regularSubscriptionPrompt.feature4Sub')}
                  </Text>
                </View>
              </View>

              {/* Feature 5 */}
              <View style={styles.featureRow}>
                <View style={[styles.featureIconBadge, {backgroundColor: `${text}28`}]}>
                  <MaterialCommunityIcons name="gift" size={18} color={text} />
                </View>
                <View style={styles.featureTexts}>
                  <Text style={styles.featureTitle}>
                    {t('regularSubscriptionPrompt.feature5Title')}
                  </Text>
                  <Text style={styles.featureSub}>
                    {t('regularSubscriptionPrompt.feature5Sub')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Bottom Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.continueFreeBtn, { borderColor: text , }]}
              onPress={onLater}
              activeOpacity={0.8}
            >
              <Text style={[styles.continueFreeText, { color: text }]}>
                {t('regularSubscriptionPrompt.continueFree')}
              </Text>
              <Text style={[styles.continueFreeSubText, { color: text }]}>
                {t('regularSubscriptionPrompt.continueFreeSub')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.learnMoreBtn, { backgroundColor: text }]}
              onPress={() => onLearnMore?.({ returnToHome: true, fromModal: true })}
              activeOpacity={0.8}
            >
              <Text style={styles.learnMoreText}>
                {t('regularSubscriptionPrompt.learnMore')}
              </Text>
              <Text style={styles.learnMoreSubText}>
                {t('regularSubscriptionPrompt.learnMoreSub')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default RegularSubscriptionPrompt;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    elevation: 99999,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  scrollContent: {
    alignItems: 'center',
  },
  crownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
    paddingTop: 8,
  },
  sparkleLeft: {
    position: 'absolute',
    left: -20,
    top: 10,
  },
  sparkleTopLeft: {
    position: 'absolute',
    left: -32,
    top: 24,
  },
  sparkleRight: {
    position: 'absolute',
    right: -24,
    top: 12,
  },
  sparkleTopRight: {
    position: 'absolute',
    right: -36,
    top: 28,
  },
  valensBanner: {
    backgroundColor: '#6B21A8',
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: -8,
  },
  valensBannerText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    color: '#1F2937',
    marginBottom: 6,
  },
  titleHighlight: {
    color: '#6B21A8',
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 18,
    lineHeight: 18,
  },
  premiumCard: {
    width: '100%',
    backgroundColor: '#F8F5FF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0E7FF',
    padding: 16,
    marginBottom: 20,
  },
  premiumHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerCrownIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  premiumHeaderTexts: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5B21B6',
    marginBottom: 2,
  },
  premiumSub: {
    fontSize: 12,
    color: '#6B7280',
  },
  featureList: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureTexts: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  featureSub: {
    fontSize: 11,
    color: '#6B7280',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  continueFreeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#6B21A8',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  continueFreeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B21A8',
  },
  continueFreeSubText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  learnMoreBtn: {
    flex: 1,
    backgroundColor: '#4C1D95',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  learnMoreSubText: {
    fontSize: 11,
    color: '#DDD6FE',
    marginTop: 1,
  },
});
