import React, { useMemo, useState } from 'react';
import {
  Image,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Share,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

// Fallback palette — used only when the theme doesn't provide a value,
// so screens still look right before useAppTheme() resolves.
const PURPLE = '#5B2FB5';
const PURPLE_2 = '#7A49D6';
const BORDER = '#E7DDF7';
const SOFT_BG = '#FBF7FF';
const TEXT = '#2F2259';
const MUTED = '#786D96';

const phoneStatus = '09:24';

const phoneBorder = {
  borderRadius: 30,
  borderWidth: 1,
  borderColor: '#EEE5FB',
  shadowColor: '#8A63D2',
  shadowOpacity: 0.08,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 14 },
  elevation: 3,
  backgroundColor: '#fff',
};

export const SAMPLE_ITEMS = [
  { id: 'jacket', name: 'Vintage Leather Jacket', price: '$120', color: '#CBBCA7', image: 'https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=600&q=80' },
  { id: 'bag', name: 'Mini Shoulder Bag', price: '$85', color: '#9B7B58', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80' },
  { id: 'sunglasses', name: 'Prada Sunglasses', price: '$220', color: '#101010', image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&q=80' },
  { id: 'coat', name: 'Burberry Trench Coat', price: '$860', color: '#D7B98A', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80' },
];

// Second-round item pool, used by the "Challenge Another Item" flow so it
// doesn't just repeat the first battle's items.
export const CHALLENGE_ITEMS = [
  { id: 'prada-sun', name: 'Prada Sunglasses', price: '$220', image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&q=80' },
  { id: 'gucci-sun', name: 'Gucci Sunglasses', price: '$230', image: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=600&q=80' },
  { id: 'black-bag', name: 'Black Handbag', price: '$85', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80' },
  { id: 'white-bag', name: 'White Handbag', price: '$85', image: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600&q=80' },
];

export const Header = ({ title, onBack, rightIcon, subtitle, onShare, accentColor, titleColor }) => (
  <View style={styles.headerRow}>
    <TouchableOpacity onPress={onBack} activeOpacity={0.8} style={styles.iconBtn}>
      <Ionicons name="arrow-back" size={22} color={titleColor || TEXT} />
    </TouchableOpacity>
    <View style={styles.headerCenter}>
      <Text style={[styles.screenTitle, { color: titleColor || TEXT }]}>{title}</Text>
      {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
    </View>
    <TouchableOpacity onPress={onShare} activeOpacity={0.8} style={styles.iconBtn}>
      <Ionicons name={rightIcon || 'share-social-outline'} size={20} color={accentColor || titleColor || TEXT} />
    </TouchableOpacity>
  </View>
);

export const PhoneFrame = ({ children }) => (
  <View style={[styles.phone, phoneBorder]}>
    <View style={styles.statusRow}>
      <Text style={styles.statusText}>{phoneStatus}</Text>
      <View style={styles.statusIcons}>
        <Ionicons name="cellular" size={10} color="#111" />
        <Ionicons name="wifi" size={10} color="#111" />
        <View style={styles.batteryPill}><Text style={styles.batteryText}>90</Text></View>
      </View>
    </View>
    {children}
  </View>
);

export const BattleCard = ({ left, right, showWinner = false, accent = PURPLE, textColor = TEXT }) => {
  const { t } = useLanguage();
  return (
    <View style={styles.cardBlock}>
      {showWinner ? (
        <View style={styles.confettiCard}>
          <Text style={[styles.winnerBadge, { color: textColor }]}>🏆 {t('battle.winner')}</Text>
          <View style={styles.winnerRow}>
            <View style={styles.heroThumb}>
              <Image source={{ uri: left.image }} style={styles.itemThumb} />
            </View>
            <View style={styles.winnerCopy}>
              <Text style={[styles.winnerTitle, { color: textColor }]}>{left.name}</Text>
              <Text style={styles.winnerPrice}>{left.price}</Text>
            </View>
            <View style={[styles.percentPill, { backgroundColor: '#22C55E' }]}><Text style={styles.percentText}>62%</Text></View>
          </View>
        </View>
      ) : null}
      <View style={styles.vsGrid}>
        <View style={styles.itemTile}>
          <Image source={{ uri: left.image }} style={styles.itemThumb} />
          <Text style={[styles.itemName, { color: textColor }]}>{left.name}</Text>
          <Text style={[styles.itemPrice, { color: accent }]}>{left.price}</Text>
        </View>
        <View style={[styles.vsBubble, { backgroundColor: accent }]}><Text style={styles.vsText}>{t('battle.vs')}</Text></View>
        <View style={styles.itemTile}>
          <Image source={{ uri: right.image }} style={styles.itemThumb} />
          <Text style={[styles.itemName, { color: textColor }]}>{right.name}</Text>
          <Text style={[styles.itemPrice, { color: accent }]}>{right.price}</Text>
        </View>
      </View>
    </View>
  );
};

// Optional results bar, used when a battle screen needs to show live
// vote share (e.g. the "Challenge Another Item" battle-in-progress view).
export const VoteSplitBar = ({ leftPercent = 50, accent = PURPLE, totalVotes, leftLabel, rightLabel }) => {
  const { t } = useLanguage();
  const rightPercent = 100 - leftPercent;
  return (
    <View style={styles.splitBarWrap}>
      <View style={styles.splitBarTrack}>
        <View style={[styles.splitBarFill, { width: `${leftPercent}%`, backgroundColor: accent }]} />
        <View style={[styles.splitBarFill, { width: `${rightPercent}%`, backgroundColor: '#D9CBEF' }]} />
      </View>
      <View style={styles.splitBarLabels}>
        <Text style={[styles.splitBarLabelText, { color: accent }]}>{leftLabel} {leftPercent}%</Text>
        <Text style={styles.splitBarLabelText}>{rightPercent}% {rightLabel}</Text>
      </View>
      {typeof totalVotes === 'number' ? (
        <Text style={styles.splitBarTotal}>{t('battle.totalVotesCount', { count: totalVotes })}</Text>
      ) : null}
    </View>
  );
};

export const Stepper = ({ active = 1, labels, accent = PURPLE }) => {
  const { t } = useLanguage();
  const stepLabels = labels || [
    t('battle.stepper.items'),
    t('battle.stepper.setup'),
    t('battle.stepper.preview'),
  ];
  return (
    <View style={styles.stepper}>
      {stepLabels.map((label, index) => {
        const step = index + 1;
        const focused = active >= step;
        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, focused && { backgroundColor: accent, borderColor: accent }]}>
                <Text style={[styles.stepCircleText, focused && styles.stepCircleTextActive]}>{step}</Text>
              </View>
              <Text style={[styles.stepLabel, focused && { color: accent }]}>{label}</Text>
            </View>
            {index < stepLabels.length - 1 ? <View style={styles.stepLine} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
};

export const StatRow = ({ items }) => (
  <View style={styles.statsRow}>
    {items.map(item => (
      <View key={item.label} style={styles.statCard}>
        <Text style={styles.statValue}>{item.value}</Text>
        <Text style={styles.statLabel}>{item.label}</Text>
      </View>
    ))}
  </View>
);

export function CreateBattleScreen({ navigation, route }) {
  const { bgStyle, text, card, bg } = useAppTheme();
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;

  // Lets this screen be reused for other rounds (e.g. "Challenge Another
  // Item") by passing a different pool of items through route params.
  const pool = route?.params?.items || SAMPLE_ITEMS;
  const headerTitle = route?.params?.headerTitle || t('battle.headerTitle');
  const nextRoute = route?.params?.nextRoute || 'BattleSetup';

  const [selectedIds, setSelectedIds] = useState(pool.slice(0, 2).map(i => i.id));
  const selectedItems = useMemo(
    () => pool.filter(item => selectedIds.includes(item.id)).slice(0, 2),
    [selectedIds, pool],
  );
  const handleShare = async () => {
    try {
      await Share.share({ message: t('battle.sharePreviewMessage') });
    } catch {
      Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
    }
  };
  return (
    <View style={[styles.screen, bgStyle]}>
      <Header title={headerTitle} onBack={() => navigation.goBack()} onShare={handleShare} accentColor={accent} titleColor={primaryText} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: primaryText }]}>{t('battle.chooseItemsTitle')}</Text>
        <Text style={styles.sectionHint}>{t('battle.chooseItemsHint')}</Text>
        <View style={styles.grid}>
          {pool.map(item => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.9}
              onPress={() => {
                setSelectedIds(prev => {
                  const isSelected = prev.includes(item.id);
                  if (isSelected) return prev.filter(id => id !== item.id);
                  if (prev.length >= 2) return [prev[1], item.id];
                  return [...prev, item.id];
                });
              }}
              style={[
                styles.gridCard,
                { backgroundColor: card || '#fff', borderColor: BORDER },
                selectedIds.includes(item.id) && [styles.gridCardSelected, { borderColor: accent }],
              ]}
            >
              {selectedIds.includes(item.id) ? (
                <View style={[styles.selectionDot, { backgroundColor: accent }]}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              ) : (
                <View style={styles.selectionDotGhost} />
              )}
              <Image source={{ uri: item.image }} style={styles.gridImage} />
              <Text style={[styles.gridName, { color: primaryText }]}>{item.name}</Text>
              <Text style={[styles.gridPrice, { color: accent }]}>{item.price}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={selectedItems.length < 2}
          onPress={() => navigation.navigate(nextRoute, { selectedItems, ...route?.params })}
        >
          <LinearGradient colors={[accent, PURPLE_2]} style={[styles.primaryButton, selectedItems.length < 2 && { opacity: 0.5 }]}>
            <Text style={styles.primaryButtonText}>{t('battle.next')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export function BattleSetupScreen({ navigation, route }) {
  const { bgStyle, text, card, bg } = useAppTheme();
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const initialQuestion = route?.params?.defaultQuestion || t('battle.defaultQuestion');
  const [question, setQuestion] = useState(initialQuestion);
  const [battleType, setBattleType] = useState('OPINION');
  const [duration, setDuration] = useState('3 DAYS');
  const [whoCanVote, setWhoCanVote] = useState(t('battle.public'));
  const [visibility, setVisibility] = useState(t('battle.public'));
  const [errors, setErrors] = useState({});

  const validate = () => {
    const nextErrors = {};
    if (!question.trim()) nextErrors.question = t('battle.errors.questionRequired');
    if (!battleType) nextErrors.battleType = t('battle.errors.typeRequired');
    if (!duration) nextErrors.duration = t('battle.errors.durationRequired');
    if (!whoCanVote) nextErrors.whoCanVote = t('battle.errors.visibilityRequired');
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePreview = () => {
    if (!validate()) return;
    const nextRoute = route?.params?.previewRoute || 'BattlePreview';
    navigation.navigate(nextRoute, {
      question,
      battleType,
      duration,
      whoCanVote,
      visibility,
      selectedItems: route?.params?.selectedItems,
    });
  };

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header
        title={t('battle.headerTitle')}
        onBack={() => navigation.goBack()}
        accentColor={accent}
        titleColor={primaryText}
        onShare={async () => {
          try {
            await Share.share({ message: t('battle.shareSetupMessage', { question }) });
          } catch {
            Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
          }
        }}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled"
      >
        <Stepper active={2} accent={accent} />
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.questionLabel')}</Text>
          <View style={[styles.inputCard, { backgroundColor: card || '#fff' }, errors.question && styles.inputCardError]}>
            <TextInput
              value={question}
              onChangeText={val => {
                setQuestion(val);
                if (errors.question) setErrors(prev => ({ ...prev, question: '' }));
              }}
              placeholder={t('battle.defaultQuestion')}
              placeholderTextColor="#ccc"
              style={[styles.inputText, { color: primaryText }]}
            />
          </View>
          {errors.question ? <Text style={styles.errorText}>{errors.question}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.typeLabel')}</Text>

          <TouchableOpacity
            onPress={() => setBattleType('OPINION')}
            activeOpacity={0.9}
            style={[styles.optionCard, battleType === 'OPINION' && { borderColor: accent, backgroundColor: card || '#F7F2FF' }]}
          >
            <View style={[styles.radioOuter, { borderColor: battleType === 'OPINION' ? accent : '#D6C8EF' }]}>
              {battleType === 'OPINION' ? <View style={[styles.radioInner, { backgroundColor: accent }]} /> : null}
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: primaryText }]}>{t('battle.opinionBattle')}</Text>
              <Text style={styles.optionSub}>{t('battle.opinionBattleSub')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setBattleType('STYLE')}
            activeOpacity={0.9}
            style={[styles.optionCard, battleType === 'STYLE' && { borderColor: accent, backgroundColor: card || '#F7F2FF' }]}
          >
            <View style={[styles.radioOuter, { borderColor: battleType === 'STYLE' ? accent : '#D6C8EF' }]}>
              {battleType === 'STYLE' ? <View style={[styles.radioInner, { backgroundColor: accent }]} /> : null}
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: primaryText }]}>{t('battle.styleBattle')}</Text>
              <Text style={styles.optionSub}>{t('battle.styleBattleSub')}</Text>
            </View>
          </TouchableOpacity>

          {errors.battleType ? <Text style={styles.errorText}>{errors.battleType}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.durationLabel')}</Text>
          <View style={styles.pillRow}>
            {[['24 HOURS', t('battle.duration24h')], ['3 DAYS', t('battle.duration3d')], ['7 DAYS', t('battle.duration7d')]].map(([value, label]) => (
              <TouchableOpacity
                key={value}
                onPress={() => setDuration(value)}
                style={[styles.pill, duration === value && [styles.pillActive, { borderColor: accent, backgroundColor: card || '#F7F2FF' }]]}
              >
                <Text style={[styles.pillText, duration === value && { color: accent, fontWeight: '800' }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.duration ? <Text style={styles.errorText}>{errors.duration}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.whoCanVote')}</Text>
          <TouchableOpacity
            onPress={() => setWhoCanVote(prev => (prev === t('battle.public') ? t('battle.followersOnly') : t('battle.public')))}
            style={styles.inlineRow}
          >
            <Text style={[styles.inlineValue, { color: primaryText }]}>{whoCanVote}</Text>
            <Text style={[styles.inlineLink, { color: accent }]}>{t('battle.change')}</Text>
          </TouchableOpacity>
          {errors.whoCanVote ? <Text style={styles.errorText}>{errors.whoCanVote}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: primaryText }]}>{t('battle.visibilityLabel')}</Text>
          <TouchableOpacity
            onPress={() => setVisibility(prev => (prev === t('battle.public') ? t('battle.private') : t('battle.public')))}
            style={styles.inlineRow}
          >
            <Text style={[styles.inlineValue, { color: primaryText }]}>{visibility}</Text>
            <Text style={[styles.inlineLink, { color: accent }]}>{t('battle.change')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.9} onPress={handlePreview}>
          <LinearGradient colors={[accent, PURPLE_2]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('battle.previewBattle')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

export function BattlePreviewScreen({ navigation, route }) {
  const { bgStyle, text, card, bg } = useAppTheme();
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const previewQuestion = route?.params?.question || t('battle.defaultQuestion');
  const selectedItems = route?.params?.selectedItems || [SAMPLE_ITEMS[0], SAMPLE_ITEMS[1]];
  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header
        title={t('battle.previewTitle')}
        onBack={() => navigation.goBack()}
        accentColor={accent}
        titleColor={primaryText}
        onShare={async () => {
          try {
            await Share.share({ message: t('battle.sharePreviewQuestionMessage', { question: previewQuestion }) });
          } catch {
            Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
          }
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Stepper active={3} accent={accent} />
        <Text style={[styles.sectionTitle, { color: primaryText }]}>{previewQuestion}</Text>
        <BattleCard left={selectedItems[0]} right={selectedItems[1]} accent={accent} textColor={primaryText} />
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>{t('battle.daysLeft', { count: 3 })}</Text>
          <Text style={styles.infoText}>{t('battle.everyoneCanVote')}</Text>
        </View>
        <View style={[styles.aboutCard, { backgroundColor: card || '#fff' }]}>
          <Text style={[styles.aboutTitle, { color: primaryText }]}>{t('battle.aboutTitle')}</Text>
          <Text style={styles.aboutText}>{t('battle.aboutTextPreview')}</Text>
        </View>
        <StatRow items={[
          { label: t('battle.stats.votes'), value: '0' },
          { label: t('battle.stats.views'), value: '0' },
          { label: t('battle.stats.comments'), value: '0' },
        ]} />
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate(route?.params?.liveRoute || 'BattleLive', { question: previewQuestion, selectedItems })}>
          <LinearGradient colors={[accent, PURPLE_2]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('battle.launchBattle')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export function BattleLiveScreen({ navigation, route }) {
  const { bgStyle, text, card, bg } = useAppTheme();
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const question = route?.params?.question || t('battle.defaultQuestion');
  const selectedItems = route?.params?.selectedItems || [SAMPLE_ITEMS[0], SAMPLE_ITEMS[1]];
  const showResultsBar = !!route?.params?.showResultsBar;
  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header
        title={t('battle.liveTitle')}
        onBack={() => navigation.goBack()}
        rightIcon="share-outline"
        accentColor={accent}
        titleColor={primaryText}
        onShare={async () => {
          try {
            await Share.share({ message: t('battle.shareLiveMessage') });
          } catch {
            Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
          }
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.liveTopRow}>
          <View style={[styles.pillOutline, { borderColor: accent }]}><Text style={[styles.pillOutlineText, { color: primaryText }]}>{t('battle.opinionBattle')}</Text></View>
          <Text style={styles.liveMuted}>{t('battle.daysLeft', { count: 3 })}</Text>
        </View>
        <Text style={[styles.sectionTitle, { color: primaryText }]}>{question}</Text>
        <BattleCard left={selectedItems[0]} right={selectedItems[1]} accent={accent} textColor={primaryText} />
        {showResultsBar ? (
          <VoteSplitBar
            leftPercent={42}
            accent={accent}
            totalVotes={245}
            leftLabel={selectedItems[0].name}
            rightLabel={selectedItems[1].name}
          />
        ) : (
          <>
            <View style={styles.voteCopy}>
              <Text style={[styles.voteTitle, { color: primaryText }]}>{t('battle.voteAndSeeResults')}</Text>
              <Text style={styles.voteSub}>{t('battle.voteHelpsOthers')}</Text>
            </View>
            <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('BattleResultsScreen')}>
              <LinearGradient colors={[accent, PURPLE_2]} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{t('battle.voteFor', { name: selectedItems[0].name })}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <View style={[styles.secondaryButton, { borderColor: accent }]}>
              <Text style={[styles.secondaryButtonText, { color: accent }]}>{t('battle.voteFor', { name: selectedItems[1].name })}</Text>
            </View>
          </>
        )}
        <StatRow items={[
          { label: t('battle.stats.votes'), value: '125' },
          { label: t('battle.stats.views'), value: '860' },
          { label: t('battle.stats.comments'), value: '24' },
        ]} />
        {showResultsBar ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('MyClosetDashboard')}>
            <LinearGradient colors={[accent, PURPLE_2]} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{t('battle.viewBattle')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

export function BattleResultsScreen({ navigation, route }) {
  const { bgStyle, text, card, bg } = useAppTheme();
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const primaryText = text || TEXT;
  const winnerItem = route?.params?.selectedItems?.[1] || SAMPLE_ITEMS[1];
  const runnerUpItem = route?.params?.selectedItems?.[0] || SAMPLE_ITEMS[0];
  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header
        title={t('battle.resultsTitle')}
        onBack={() => navigation.goBack()}
        accentColor={accent}
        titleColor={primaryText}
        onShare={async () => {
          try {
            await Share.share({ message: t('battle.shareResultsMessage') });
          } catch {
            Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
          }
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <BattleCard left={winnerItem} right={runnerUpItem} showWinner accent={accent} textColor={primaryText} />
        <View style={[styles.resultsBlock, { backgroundColor: card || '#fff' }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>{t('battle.battleInsights')}</Text>
          <View style={styles.resultsRow}><Text style={styles.resultsLabel}>{t('battle.stats.totalVotes')}</Text><Text style={[styles.resultsValue, { color: primaryText }]}>125</Text></View>
          <View style={styles.resultsRow}><Text style={styles.resultsLabel}>{t('battle.stats.totalViews')}</Text><Text style={[styles.resultsValue, { color: primaryText }]}>860</Text></View>
          <View style={styles.resultsRow}><Text style={styles.resultsLabel}>{t('battle.stats.comments')}</Text><Text style={[styles.resultsValue, { color: primaryText }]}>24</Text></View>
          <View style={styles.resultsRow}><Text style={styles.resultsLabel}>{t('battle.stats.shares')}</Text><Text style={[styles.resultsValue, { color: primaryText }]}>12</Text></View>
        </View>
        <View style={[styles.aboutCard, { backgroundColor: card || '#fff' }]}>
          <Text style={[styles.aboutTitle, { color: primaryText }]}>{t('battle.useInsightsTitle')}</Text>
          <Text style={styles.aboutText}>{t('battle.useInsightsText')}</Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity activeOpacity={0.9} style={[styles.outlineBtn, { borderColor: accent }]} onPress={() => Share.share({ message: t('battle.shareResultsMessage') }).catch(() => { })}>
            <Text style={[styles.outlineBtnText, { color: accent }]}>{t('battle.shareResults')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.actionBtn, { backgroundColor: accent }]}
            onPress={() => navigation.navigate('BattleInsightsActions', { winnerItem, runnerUpItem })}
          >
            <Text style={styles.actionBtnText}>{t('battle.useInsights')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  screenTitle: { fontSize: 18, fontWeight: '800' },
  screenSubtitle: { marginTop: 2, fontSize: 12, color: MUTED, fontWeight: '600' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 30, gap: 12 },
  phone: { padding: 14, marginTop: 2 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  statusText: { fontSize: 12, fontWeight: '800', color: '#111' },
  statusIcons: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  batteryPill: { borderWidth: 1, borderColor: '#111', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  batteryText: { fontSize: 8, fontWeight: '800' },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  sectionHint: { fontSize: 12, color: MUTED, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: { width: '48%', borderRadius: 18, borderWidth: 1, padding: 10 },
  gridCardSelected: { transform: [{ translateY: -2 }] },
  selectionDot: { position: 'absolute', top: 10, left: 10, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  selectionDotGhost: { position: 'absolute', top: 10, left: 10, width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#D8CBEF', backgroundColor: '#fff', zIndex: 1 },
  gridImage: { height: 120, borderRadius: 14, marginBottom: 8 },
  gridName: { fontSize: 12, fontWeight: '700' },
  gridPrice: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  primaryButton: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  stepper: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  stepItem: { alignItems: 'center', gap: 6 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#D6C8EF', alignItems: 'center', justifyContent: 'center' },
  stepCircleText: { color: '#8B7AAE', fontWeight: '800' },
  stepCircleTextActive: { color: '#fff' },
  stepLabel: { fontSize: 11, color: MUTED, fontWeight: '700' },
  stepLine: { flex: 1, height: 1, backgroundColor: '#D6C8EF', marginHorizontal: 10, marginBottom: 18 },
  field: { gap: 8, marginTop: 4 },
  fieldLabel: { fontSize: 14, fontWeight: '800' },
  inputCard: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14 },
  inputCardError: { borderColor: '#ef4444' },
  inputText: { fontWeight: '600' },
  optionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 14, backgroundColor: '#fff', marginTop: 10 },
  optionTitle: { fontWeight: '800' },
  optionTextWrap: { flex: 1 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  optionSub: { color: MUTED, fontSize: 12, marginTop: 3 },
  pillRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff' },
  pillActive: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  pillText: { color: TEXT, fontWeight: '800', fontSize: 12 },
  inlineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 12 },
  inlineValue: { fontWeight: '700' },
  inlineLink: { fontWeight: '800' },
  errorText: { color: '#ef4444', fontSize: 12, fontWeight: '700', marginTop: 4 },
  vsGrid: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemTile: { flex: 1, alignItems: 'flex-start' },
  itemThumb: { width: '100%', height: 130, borderRadius: 16, marginBottom: 8 },
  itemName: { fontSize: 12, fontWeight: '700' },
  itemPrice: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  vsBubble: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  vsText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  cardBlock: { gap: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoText: { color: MUTED, fontSize: 12, fontWeight: '700' },
  aboutCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 4 },
  aboutTitle: { fontWeight: '900', fontSize: 14 },
  aboutText: { color: MUTED, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 12, alignItems: 'center' },
  statValue: { color: TEXT, fontWeight: '900', fontSize: 18 },
  statLabel: { color: MUTED, fontWeight: '700', fontSize: 11, marginTop: 2 },
  liveTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pillOutline: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff' },
  pillOutlineText: { fontSize: 11, fontWeight: '800' },
  liveMuted: { color: MUTED, fontWeight: '700', fontSize: 12 },
  voteCopy: { gap: 4 },
  voteTitle: { fontSize: 14, fontWeight: '900' },
  voteSub: { fontSize: 12, fontWeight: '600', color: MUTED },
  secondaryButton: { height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  secondaryButtonText: { fontWeight: '900' },
  splitBarWrap: { gap: 6 },
  splitBarTrack: { flexDirection: 'row', height: 10, borderRadius: 6, overflow: 'hidden' },
  splitBarFill: { height: '100%' },
  splitBarLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  splitBarLabelText: { fontSize: 11, fontWeight: '800', color: MUTED },
  splitBarTotal: { fontSize: 12, fontWeight: '800', color: TEXT, marginTop: 2 },
  confettiCard: { backgroundColor: '#FBF3FF', borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 12 },
  winnerBadge: { fontSize: 14, fontWeight: '900', textAlign: 'center' },
  winnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroThumb: { width: 86, height: 86, borderRadius: 16, overflow: 'hidden' },
  winnerCopy: { flex: 1 },
  winnerTitle: { fontSize: 14, fontWeight: '900' },
  winnerPrice: { marginTop: 4, fontSize: 12, color: TEXT, fontWeight: '700' },
  percentPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  percentText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  resultsBlock: { gap: 10, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14 },
  resultsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1E8FB' },
  resultsLabel: { color: MUTED, fontWeight: '700' },
  resultsValue: { fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 10 },
  outlineBtn: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  outlineBtnText: { fontWeight: '900' },
  actionBtn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '900' },
});