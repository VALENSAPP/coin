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
import { useThemeContext } from '../../theme/ThemeContext';

const RegularSubscriptionPrompt = ({ visible, onLearnMore, onLater, isBusinessProfile }) => {
  const { t } = useLanguage();
  const { isDarkMode } = useThemeContext();
  const { cardStyle, textStyle, text, bgStyle, mutedText, border, card, accent } = useAppTheme();

  if (!visible) return null;

  const isCompany = Boolean(isBusinessProfile);

  // Theme Colors for User & Company profile in Dark & Light modes
  const themeAccent = isCompany ? (accent || '#C9A15A') : (isDarkMode ? '#A78BFA' : (text || accent));
  const themeBtnBg = isCompany ? (accent || '#C9A15A') : (isDarkMode ? accent : accent);

  const cardBg = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const cardBorder = isDarkMode ? '#333333' : '#E5E7EB';
  const innerCardBg = isDarkMode ? '#18181B' : '#F8F5FF';
  const innerCardBorder = isDarkMode ? '#3F3F46' : '#F0E7FF';

  const titleColor = isDarkMode ? '#FFFFFF' : '#1F2937';
  const subtextColor = isDarkMode ? '#9CA3AF' : '#6B7280';
  const featureBadgeBg = isDarkMode
    ? (isCompany ? 'rgba(201, 161, 90, 0.2)' : 'rgba(167, 139, 250, 0.18)')
    : (isCompany ? 'rgba(201, 161, 90, 0.12)' : 'rgba(107, 33, 168, 0.1)');

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor: cardBorder, borderWidth: isDarkMode ? 1 : 0 }]}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onLater}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={22} color={subtextColor} />
        </TouchableOpacity>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header Crown Graphic */}
          <View style={styles.crownContainer}>
            <View style={styles.sparkleLeft}>
              <MaterialCommunityIcons name="star-four-points" size={16} color={accent} />
            </View>
            <View style={styles.sparkleTopLeft}>
              <MaterialCommunityIcons name="star-four-points" size={12} color={accent} />
            </View>
            <View style={styles.sparkleRight}>
              <MaterialCommunityIcons name="star-four-points" size={18} color={accent} />
            </View>
            <View style={styles.sparkleTopRight}>
              <MaterialCommunityIcons name="star-four-points" size={14} color={accent} />
            </View>

            <MaterialCommunityIcons name="crown" size={54} color={accent} />
            <View style={[styles.valensBanner, { backgroundColor: accent }]}>
              <Text style={[styles.valensBannerText, { color: '#FFFFFF' }]}>VALENS</Text>
            </View>
          </View>

          {/* Title & Subtitle */}
          <Text style={[styles.title, { color: titleColor }]}>
            {t('regularSubscriptionPrompt.titlePrefix')}
            <Text style={[styles.titleHighlight, { color: accent }]}>
              {t('regularSubscriptionPrompt.titleHighlight')}
            </Text>
          </Text>

          <Text style={[styles.subtitle, { color: subtextColor }]}>
            {t('regularSubscriptionPrompt.subtitle')}
          </Text>

          {/* Premium Container Card */}
          <View style={[styles.premiumCard, { backgroundColor: innerCardBg, borderColor: innerCardBorder }]}>
            <View style={styles.premiumHeaderRow}>
              <MaterialCommunityIcons name="crown" size={24} color={accent} style={styles.headerCrownIcon} />
              <View style={styles.premiumHeaderTexts}>
                <Text style={[styles.premiumTitle, { color: titleColor }]}>
                  {t('regularSubscriptionPrompt.premiumTitle')}
                </Text>
                <Text style={[styles.premiumSub, { color: subtextColor }]}>
                  {t('regularSubscriptionPrompt.premiumSub')}
                </Text>
              </View>
            </View>

            {/* Feature List */}
            <View style={styles.featureList}>
              {/* Feature 1 */}
              <View style={styles.featureRow}>
                <View style={[styles.featureIconBadge, { backgroundColor: featureBadgeBg }]}>
                  <MaterialCommunityIcons name="target" size={18} color={accent} />
                </View>
                <View style={styles.featureTexts}>
                  <Text style={[styles.featureTitle, { color: titleColor }]}>
                    {t('regularSubscriptionPrompt.feature1Title')}
                  </Text>
                  <Text style={[styles.featureSub, { color: subtextColor }]}>
                    {t('regularSubscriptionPrompt.feature1Sub')}
                  </Text>
                </View>
              </View>

              {/* Feature 2 */}
              <View style={styles.featureRow}>
                <View style={[styles.featureIconBadge, { backgroundColor: featureBadgeBg }]}>
                  <MaterialCommunityIcons name="crown" size={18} color={accent} />
                </View>
                <View style={styles.featureTexts}>
                  <Text style={[styles.featureTitle, { color: titleColor }]}>
                    {t('regularSubscriptionPrompt.feature2Title')}
                  </Text>
                  <Text style={[styles.featureSub, { color: subtextColor }]}>
                    {t('regularSubscriptionPrompt.feature2Sub')}
                  </Text>
                </View>
              </View>

              {/* Feature 3 */}
              <View style={styles.featureRow}>
                <View style={[styles.featureIconBadge, { backgroundColor: featureBadgeBg }]}>
                  <MaterialCommunityIcons name="star" size={18} color={accent} />
                </View>
                <View style={styles.featureTexts}>
                  <Text style={[styles.featureTitle, { color: titleColor }]}>
                    {t('regularSubscriptionPrompt.feature3Title')}
                  </Text>
                  <Text style={[styles.featureSub, { color: subtextColor }]}>
                    {t('regularSubscriptionPrompt.feature3Sub')}
                  </Text>
                </View>
              </View>

              {/* Feature 4 */}
              <View style={styles.featureRow}>
                <View style={[styles.featureIconBadge, { backgroundColor: featureBadgeBg }]}>
                  <MaterialCommunityIcons name="poll" size={18} color={accent} />
                </View>
                <View style={styles.featureTexts}>
                  <Text style={[styles.featureTitle, { color: titleColor }]}>
                    {t('regularSubscriptionPrompt.feature4Title')}
                  </Text>
                  <Text style={[styles.featureSub, { color: subtextColor }]}>
                    {t('regularSubscriptionPrompt.feature4Sub')}
                  </Text>
                </View>
              </View>

              {/* Feature 5 */}
              <View style={styles.featureRow}>
                <View style={[styles.featureIconBadge, { backgroundColor: featureBadgeBg }]}>
                  <MaterialCommunityIcons name="gift" size={18} color={accent} />
                </View>
                <View style={styles.featureTexts}>
                  <Text style={[styles.featureTitle, { color: titleColor }]}>
                    {t('regularSubscriptionPrompt.feature5Title')}
                  </Text>
                  <Text style={[styles.featureSub, { color: subtextColor }]}>
                    {t('regularSubscriptionPrompt.feature5Sub')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Bottom Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.continueFreeBtn, { backgroundColor: cardBg, borderColor: accent }]}
              onPress={onLater}
              activeOpacity={0.8}
            >
              <Text style={[styles.continueFreeText, { color: accent }]}>
                {t('regularSubscriptionPrompt.continueFree')}
              </Text>
              <Text style={[styles.continueFreeSubText, { color: subtextColor }]}>
                {t('regularSubscriptionPrompt.continueFreeSub')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.learnMoreBtn, { backgroundColor: themeBtnBg }]}
              onPress={() => onLearnMore?.({ returnToHome: true, fromModal: true })}
              activeOpacity={0.8}
            >
              <Text style={[styles.learnMoreText, { color: isCompany && isDarkMode ? '#000000' : '#FFFFFF' }]}>
                {t('regularSubscriptionPrompt.learnMore')}
              </Text>
              <Text style={[styles.learnMoreSubText, { color: isCompany && isDarkMode ? '#374151' : '#DDD6FE' }]}>
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
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: -8,
  },
  valensBannerText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  titleHighlight: {
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 18,
    lineHeight: 18,
  },
  premiumCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
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
    marginBottom: 2,
  },
  premiumSub: {
    fontSize: 12,
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
  },
  featureSub: {
    fontSize: 11,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  continueFreeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueFreeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  continueFreeSubText: {
    fontSize: 11,
    marginTop: 1,
  },
  learnMoreBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnMoreText: {
    fontSize: 14,
    fontWeight: '700',
  },
  learnMoreSubText: {
    fontSize: 11,
    marginTop: 1,
  },
});
