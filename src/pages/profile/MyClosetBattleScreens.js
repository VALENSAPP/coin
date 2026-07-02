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

const SAMPLE_ITEMS = [
  { id: 'jacket', name: 'Vintage Leather Jacket', price: '$120', color: '#CBBCA7', image: 'https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=600&q=80' },
  { id: 'bag', name: 'Mini Shoulder Bag', price: '$85', color: '#9B7B58', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80' },
  { id: 'sunglasses', name: 'Prada Sunglasses', price: '$220', color: '#101010', image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&q=80' },
  { id: 'coat', name: 'Burberry Trench Coat', price: '$860', color: '#D7B98A', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80' },
];

const Header = ({ title, onBack, rightIcon, subtitle, onShare }) => (
  <View style={styles.headerRow}>
    <TouchableOpacity onPress={onBack} activeOpacity={0.8} style={styles.iconBtn}>
      <Ionicons name="arrow-back" size={22} color={TEXT} />
    </TouchableOpacity>
    <View style={styles.headerCenter}>
      <Text style={styles.screenTitle}>{title}</Text>
      {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
    </View>
    <TouchableOpacity onPress={onShare} activeOpacity={0.8} style={styles.iconBtn}>
      <Ionicons name={rightIcon || 'share-social-outline'} size={20} color={TEXT} />
    </TouchableOpacity>
  </View>
);

const PhoneFrame = ({ children }) => (
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

const BattleCard = ({ left, right, showWinner = false, accent = PURPLE }) => {
  const { t } = useLanguage();
  return (
    <View style={styles.cardBlock}>
      {showWinner ? (
        <View style={styles.confettiCard}>
          <Text style={styles.winnerBadge}>🏆 {t('battle.winner')}</Text>
          <View style={styles.winnerRow}>
            <View style={styles.heroThumb}>
              <View style={[styles.itemThumb, { backgroundColor: '#C9B79E' }]} />
            </View>
            <View style={styles.winnerCopy}>
              <Text style={styles.winnerTitle}>{left.name}</Text>
              <Text style={styles.winnerPrice}>{left.price}</Text>
            </View>
            <View style={[styles.percentPill, { backgroundColor: accent }]}><Text style={styles.percentText}>62%</Text></View>
          </View>
        </View>
      ) : null}
      <View style={styles.vsGrid}>
        <View style={styles.itemTile}>
          <Image source={{ uri: left.image }} style={styles.itemThumb} />
          <Text style={styles.itemName}>{left.name}</Text>
          <Text style={styles.itemPrice}>{left.price}</Text>
        </View>
        <View style={styles.vsBubble}><Text style={styles.vsText}>{t('battle.vs')}</Text></View>
        <View style={styles.itemTile}>
          <Image source={{ uri: right.image }} style={styles.itemThumb} />
          <Text style={styles.itemName}>{right.name}</Text>
          <Text style={styles.itemPrice}>{right.price}</Text>
        </View>
      </View>
    </View>
  );
};

const Stepper = ({ active = 1, labels }) => {
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
              <View style={[styles.stepCircle, focused && styles.stepCircleActive]}>
                <Text style={[styles.stepCircleText, focused && styles.stepCircleTextActive]}>{step}</Text>
              </View>
              <Text style={[styles.stepLabel, focused && styles.stepLabelActive]}>{label}</Text>
            </View>
            {index < stepLabels.length - 1 ? <View style={styles.stepLine} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const StatRow = ({ items }) => (
  <View style={styles.statsRow}>
    {items.map(item => (
      <View key={item.label} style={styles.statCard}>
        <Text style={styles.statValue}>{item.value}</Text>
        <Text style={styles.statLabel}>{item.label}</Text>
      </View>
    ))}
  </View>
);

export function CreateBattleScreen({ navigation }) {
  const { bgStyle, text, card, bg } = useAppTheme();
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const [selectedIds, setSelectedIds] = useState(['jacket', 'bag']);
  const selectedItems = useMemo(
    () => SAMPLE_ITEMS.filter(item => selectedIds.includes(item.id)).slice(0, 2),
    [selectedIds],
  );
  const handleShare = async () => {
    try {
      await Share.share({
        message: t('battle.sharePreviewMessage'),
      });
    } catch {
      Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
    }
  };
  return (
    <View style={[styles.screen, bgStyle]}>
      <Header title={t('battle.headerTitle')} onBack={() => navigation.goBack()} onShare={handleShare} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t('battle.chooseItemsTitle')}</Text>
        <Text style={styles.sectionHint}>{t('battle.chooseItemsHint')}</Text>
        <View style={styles.grid}>
          {SAMPLE_ITEMS.map((item, index) => (
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
                { backgroundColor: card || '#fff', borderColor: accent },
                selectedIds.includes(item.id) && styles.gridCardSelected,
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
              <Text style={styles.gridName}>{item.name}</Text>
              <Text style={[styles.gridPrice, { color: accent }]}>{item.price}.00</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('BattleSetup', { selectedItems })}>
          <LinearGradient colors={[accent, PURPLE_2]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('battle.next')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export function BattleSetupScreen({ navigation }) {
  const { bgStyle, text, card, bg } = useAppTheme();
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const initialQuestion = t('battle.defaultQuestion');
  const [question, setQuestion] = useState(initialQuestion);
  const [battleType, setBattleType] = useState('OPINION');
  const [duration, setDuration] = useState('3 DAYS');
  const [visibility, setVisibility] = useState(t('battle.public'));
  const [errors, setErrors] = useState({});

  const validate = () => {
    const nextErrors = {};
    if (!question.trim()) nextErrors.question = t('battle.errors.questionRequired');
    if (!battleType) nextErrors.battleType = t('battle.errors.typeRequired');
    if (!duration) nextErrors.duration = t('battle.errors.durationRequired');
    if (!visibility) nextErrors.visibility = t('battle.errors.visibilityRequired');
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePreview = () => {
    if (!validate()) return;
    navigation.navigate('BattlePreview', { question, battleType, duration, visibility });
  };

  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header
        title={t('battle.headerTitle')}
        onBack={() => navigation.goBack()}
        onShare={async () => {
          try {
            await Share.share({ message: t('battle.shareSetupMessage', { question }) });
          } catch {
            Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
          }
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Stepper active={2} />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('battle.questionLabel')}</Text>
          <View style={[styles.inputCard, errors.question && styles.inputCardError]}>
            <TextInput
              value={question}
              onChangeText={text => {
                setQuestion(text);
                if (errors.question) setErrors(prev => ({ ...prev, question: '' }));
              }}
              placeholder={t('battle.defaultQuestion')}
              placeholderTextColor="#a78bfa"
              style={styles.inputText}
            />
          </View>
          {errors.question ? <Text style={styles.errorText}>{errors.question}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('battle.typeLabel')}</Text>
          <TouchableOpacity onPress={() => setBattleType('OPINION')} activeOpacity={0.9} style={[styles.optionCardSelected, battleType === 'OPINION' && { borderColor: accent, backgroundColor: card || '#fff' }]}>
            <Text style={styles.optionTitle}>{t('battle.opinionBattle')}</Text>
            <Text style={styles.optionSub}>{t('battle.opinionBattleSub')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setBattleType('STYLE')} activeOpacity={0.9} style={[styles.optionCard, battleType === 'STYLE' && { borderColor: accent, backgroundColor: card || '#fff' }]}>
            <Text style={styles.optionTitle}>{t('battle.styleBattle')}</Text>
            <Text style={styles.optionSub}>{t('battle.styleBattleSub')}</Text>
          </TouchableOpacity>
          {errors.battleType ? <Text style={styles.errorText}>{errors.battleType}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('battle.durationLabel')}</Text>
          <View style={styles.pillRow}>
            <TouchableOpacity onPress={() => setDuration('24 HOURS')} style={styles.pill}><Text style={styles.pillText}>{t('battle.duration24h')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setDuration('3 DAYS')} style={[styles.pillActive, { borderColor: accent }]}><Text style={[styles.pillTextActive, { color: accent }]}>{t('battle.duration3d')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setDuration('7 DAYS')} style={styles.pill}><Text style={styles.pillText}>{t('battle.duration7d')}</Text></TouchableOpacity>
          </View>
          {errors.duration ? <Text style={styles.errorText}>{errors.duration}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('battle.whoCanVote')}</Text>
          <TouchableOpacity onPress={() => setVisibility(prev => (prev === t('battle.public') ? t('battle.followersOnly') : t('battle.public')))} style={styles.inlineRow}>
            <Text style={styles.inlineValue}>{visibility}</Text>
            <Text style={styles.inlineLink}>{t('battle.change')}</Text>
          </TouchableOpacity>
          {errors.visibility ? <Text style={styles.errorText}>{errors.visibility}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('battle.visibilityLabel')}</Text>
          <TouchableOpacity onPress={() => setVisibility(prev => (prev === t('battle.public') ? t('battle.private') : t('battle.public')))} style={styles.inlineRow}>
            <Text style={styles.inlineValue}>{visibility}</Text>
            <Text style={styles.inlineLink}>{t('battle.change')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.9} onPress={handlePreview}>
          <LinearGradient colors={[accent, PURPLE_2]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('battle.previewBattle')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export function BattlePreviewScreen({ navigation }) {
  const { bgStyle, text, card, bg } = useAppTheme();
  const { t } = useLanguage();
  const accent = text || PURPLE;
  const route = navigation?.getState?.()?.routes?.find?.(r => r.name === 'BattlePreview');
  const previewQuestion = route?.params?.question || t('battle.defaultQuestion');
  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header
        title={t('battle.previewTitle')}
        onBack={() => navigation.goBack()}
        onShare={async () => {
          try {
            await Share.share({ message: t('battle.sharePreviewQuestionMessage', { question: previewQuestion }) });
          } catch {
            Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
          }
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Stepper active={3} />
        <Text style={styles.sectionTitle}>{previewQuestion}</Text>
        <BattleCard left={SAMPLE_ITEMS[0]} right={SAMPLE_ITEMS[1]} accent={accent} />
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>{t('battle.daysLeft', { count: 3 })}</Text>
          <Text style={styles.infoText}>{t('battle.everyoneCanVote')}</Text>
        </View>
        <View style={[styles.aboutCard, { backgroundColor: card || '#fff' }]}>
          <Text style={styles.aboutTitle}>{t('battle.aboutTitle')}</Text>
          <Text style={styles.aboutText}>{t('battle.aboutTextPreview')}</Text>
        </View>
        <StatRow items={[
          { label: t('battle.stats.votes'), value: '0' },
          { label: t('battle.stats.views'), value: '0' },
          { label: t('battle.stats.comments'), value: '0' },
        ]} />
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('BattleLive')}>
          <LinearGradient colors={[accent, PURPLE_2]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('battle.launchBattle')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export function BattleLiveScreen({ navigation }) {
  const { bgStyle, text, card, bg } = useAppTheme();
  const { t } = useLanguage();
  const accent = text || PURPLE;
  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header
        title={t('battle.liveTitle')}
        onBack={() => navigation.goBack()}
        rightIcon="share-outline"
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
          <View style={[styles.pillOutline, { borderColor: accent }]}><Text style={[styles.pillOutlineText, { color: accent }]}>{t('battle.opinionBattle')}</Text></View>
          <Text style={styles.liveMuted}>{t('battle.daysLeft', { count: 3 })}</Text>
        </View>
        <Text style={styles.sectionTitle}>{t('battle.defaultQuestion')}</Text>
        <BattleCard left={SAMPLE_ITEMS[0]} right={SAMPLE_ITEMS[1]} accent={accent} />
        <View style={styles.voteCopy}>
          <Text style={styles.voteTitle}>{t('battle.voteAndSeeResults')}</Text>
          <Text style={styles.voteSub}>{t('battle.voteHelpsOthers')}</Text>
        </View>
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('BattleResultsScreen')}>
          <LinearGradient colors={[accent, PURPLE_2]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('battle.voteFor', { name: SAMPLE_ITEMS[0].name })}</Text>
          </LinearGradient>
        </TouchableOpacity>
        <View style={[styles.secondaryButton, { borderColor: accent }]}>
          <Text style={[styles.secondaryButtonText, { color: accent }]}>{t('battle.voteFor', { name: SAMPLE_ITEMS[1].name })}</Text>
        </View>
        <StatRow items={[
          { label: t('battle.stats.votes'), value: '125' },
          { label: t('battle.stats.views'), value: '860' },
          { label: t('battle.stats.comments'), value: '24' },
        ]} />
      </ScrollView>
    </View>
  );
}

export function BattleResultsScreen({ navigation }) {
  const { bgStyle, text, card, bg } = useAppTheme();
  const { t } = useLanguage();
  const accent = text || PURPLE;
  return (
    <View style={[styles.screen, bgStyle, { backgroundColor: bg || SOFT_BG }]}>
      <Header
        title={t('battle.resultsTitle')}
        onBack={() => navigation.goBack()}
        onShare={async () => {
          try {
            await Share.share({ message: t('battle.shareResultsMessage') });
          } catch {
            Alert.alert(t('battle.shareTitle'), t('battle.shareUnavailable'));
          }
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <BattleCard left={SAMPLE_ITEMS[1]} right={SAMPLE_ITEMS[0]} showWinner accent={accent} />
        <View style={[styles.resultsBlock, { backgroundColor: card || '#fff' }]}>
          <Text style={styles.sectionTitle}>{t('battle.battleInsights')}</Text>
          <View style={styles.resultsRow}><Text style={styles.resultsLabel}>{t('battle.stats.totalVotes')}</Text><Text style={styles.resultsValue}>125</Text></View>
          <View style={styles.resultsRow}><Text style={styles.resultsLabel}>{t('battle.stats.totalViews')}</Text><Text style={styles.resultsValue}>860</Text></View>
          <View style={styles.resultsRow}><Text style={styles.resultsLabel}>{t('battle.stats.comments')}</Text><Text style={styles.resultsValue}>24</Text></View>
          <View style={styles.resultsRow}><Text style={styles.resultsLabel}>{t('battle.stats.shares')}</Text><Text style={styles.resultsValue}>12</Text></View>
        </View>
        <View style={[styles.aboutCard, { backgroundColor: card || '#fff' }]}>
          <Text style={styles.aboutTitle}>{t('battle.useInsightsTitle')}</Text>
          <Text style={styles.aboutText}>{t('battle.useInsightsText')}</Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity activeOpacity={0.9} style={[styles.outlineBtn, { borderColor: accent }]}><Text style={[styles.outlineBtnText, { color: accent }]}>{t('battle.shareResults')}</Text></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} style={[styles.actionBtn, { backgroundColor: accent }]}><Text style={styles.actionBtnText}>{t('battle.viewItem')}</Text></TouchableOpacity>
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
  screenTitle: { fontSize: 18, fontWeight: '800', color: TEXT },
  screenSubtitle: { marginTop: 2, fontSize: 12, color: MUTED, fontWeight: '600' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 28, gap: 12 },
  phone: { padding: 14, marginTop: 2 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  statusText: { fontSize: 12, fontWeight: '800', color: '#111' },
  statusIcons: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  batteryPill: { borderWidth: 1, borderColor: '#111', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  batteryText: { fontSize: 8, fontWeight: '800' },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: TEXT, marginTop: 4 },
  sectionHint: { fontSize: 12, color: MUTED, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: { width: '48%', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 10 },
  gridCardSelected: { transform: [{ translateY: -2 }] },
  selectionDot: { position: 'absolute', top: 10, left: 10, width: 18, height: 18, borderRadius: 9, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  selectionDotGhost: { position: 'absolute', top: 10, left: 10, width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#D8CBEF', backgroundColor: '#fff', zIndex: 1 },
  gridImage: { height: 120, borderRadius: 14, marginBottom: 8 },
  gridName: { fontSize: 12, fontWeight: '700', color: TEXT },
  gridPrice: { fontSize: 12, color: PURPLE, fontWeight: '800', marginTop: 4 },
  primaryButton: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  stepper: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  stepItem: { alignItems: 'center', gap: 6 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#D6C8EF', alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: PURPLE, borderColor: PURPLE },
  stepCircleText: { color: '#8B7AAE', fontWeight: '800' },
  stepCircleTextActive: { color: '#fff' },
  stepLabel: { fontSize: 11, color: MUTED, fontWeight: '700' },
  stepLabelActive: { color: PURPLE },
  stepLine: { flex: 1, height: 1, backgroundColor: '#D6C8EF', marginHorizontal: 10, marginBottom: 18 },
  field: { gap: 8, marginTop: 4 },
  fieldLabel: { fontSize: 14, fontWeight: '800', color: TEXT },
  inputCard: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14, backgroundColor: '#fff' },
  inputCardError: { borderColor: '#ef4444' },
  inputText: { color: TEXT, fontWeight: '600' },
  optionCard: { borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 14, backgroundColor: '#fff', marginTop: 10 },
  optionCardSelected: { borderWidth: 1, borderColor: PURPLE, borderRadius: 16, padding: 14, backgroundColor: '#F7F2FF', marginTop: 10 },
  optionTitle: { color: TEXT, fontWeight: '800' },
  optionSub: { color: MUTED, fontSize: 12, marginTop: 3 },
  pillRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff' },
  pillActive: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: PURPLE, backgroundColor: '#F7F2FF' },
  pillText: { color: TEXT, fontWeight: '800', fontSize: 12 },
  pillTextActive: { color: PURPLE, fontWeight: '800', fontSize: 12 },
  inlineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 12 },
  inlineValue: { fontWeight: '700', color: TEXT },
  inlineLink: { color: PURPLE, fontWeight: '800' },
  errorText: { color: '#ef4444', fontSize: 12, fontWeight: '700', marginTop: 4 },
  vsGrid: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemTile: { flex: 1, alignItems: 'flex-start' },
  itemThumb: { width: '100%', height: 130, borderRadius: 16, marginBottom: 8 },
  itemName: { fontSize: 12, fontWeight: '700', color: TEXT },
  itemPrice: { fontSize: 12, fontWeight: '800', color: PURPLE, marginTop: 4 },
  vsBubble: { width: 34, height: 34, borderRadius: 17, backgroundColor: PURPLE_2, alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  vsText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  cardBlock: { gap: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoText: { color: MUTED, fontSize: 12, fontWeight: '700' },
  aboutCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 4 },
  aboutTitle: { color: TEXT, fontWeight: '900', fontSize: 14 },
  aboutText: { color: MUTED, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 12, alignItems: 'center' },
  statValue: { color: TEXT, fontWeight: '900', fontSize: 18 },
  statLabel: { color: MUTED, fontWeight: '700', fontSize: 11, marginTop: 2 },
  liveTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pillOutline: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff' },
  pillOutlineText: { fontSize: 11, fontWeight: '800', color: TEXT },
  liveMuted: { color: MUTED, fontWeight: '700', fontSize: 12 },
  voteCopy: { gap: 4 },
  voteTitle: { fontSize: 14, fontWeight: '900', color: TEXT },
  voteSub: { fontSize: 12, fontWeight: '600', color: MUTED },
  secondaryButton: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: PURPLE, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  secondaryButtonText: { color: PURPLE, fontWeight: '900' },
  confettiCard: { backgroundColor: '#FBF3FF', borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 12 },
  winnerBadge: { fontSize: 14, fontWeight: '900', color: TEXT, textAlign: 'center' },
  winnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroThumb: { width: 86, height: 86, borderRadius: 16, overflow: 'hidden' },
  winnerCopy: { flex: 1 },
  winnerTitle: { fontSize: 14, fontWeight: '900', color: TEXT },
  winnerPrice: { marginTop: 4, fontSize: 12, color: TEXT, fontWeight: '700' },
  percentPill: { backgroundColor: '#22C55E', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  percentText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  resultsBlock: { gap: 10, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14 },
  resultsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1E8FB' },
  resultsLabel: { color: MUTED, fontWeight: '700' },
  resultsValue: { color: TEXT, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 10 },
  outlineBtn: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, borderColor: PURPLE, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  outlineBtnText: { color: PURPLE, fontWeight: '900' },
  actionBtn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: PURPLE },
  actionBtnText: { color: '#fff', fontWeight: '900' },
  confettiCard: { backgroundColor: '#FBF3FF', borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 12 },
});
