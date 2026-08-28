/**
 * useNotificationSetup.js
 *
 * Encapsulates all FCM + Notifee notification wiring that previously lived in Main.js.
 * Returns nothing — it is a "side-effect only" hook.
 *
 * Usage:
 *   useNotificationSetup({ showNotificationToast, setMessage });
 */

import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import {
    createNotificationChannels,
    PENDING_NOTIFICATION_MODAL_KEY,
    displayFcmAsExpandable,
} from '../services/NotificationService';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Logs every known notification type with its relevant fields. */
const logTypedNotification = (tag, data = {}, type = '(no type)') => {
    const log = (label, ...args) =>
        console.log(`[NOTIF] ${tag} [${type}] ${label}`, ...args);

    switch (type) {
        case 'follow':
            log('followerDisplayName:', data.followerDisplayName);
            log('followerImage      :', data.followerImage);
            log('expandedTitle      :', data.expandedTitle);
            log('expandedBody       :', data.expandedBody);
            break;

        case 'battle_invite':
            log('inviterUserName    :', data.inviterUserName);
            log('question           :', data.question);
            log('challengerSide     :', data.challengerSide);
            log('challengerArgument :', data.challengerArgument);
            log('remainingSide      :', data.remainingSide);
            log('participantCount   :', data.participantCount);
            log('endTime            :', data.endTime);
            break;

        case 'battle_started':
            log('question  :', data.question);
            log('sideALabel:', data.sideALabel, '| count:', data.sideACount);
            log('sideBLabel:', data.sideBLabel, '| count:', data.sideBCount);
            log('battleId  :', data.battleId);
            log('endTime   :', data.endTime);
            log('deepLink  :', data.deepLink);
            break;

        case 'battle_victory':
            log('resultText    :', data.resultText);
            log('credibilityGain:', data.credibilityGain);
            log('accuracyRate  :', data.accuracyRate);
            log('winningSide   :', data.winningSide);
            log('userSide      :', data.userSide);
            log('badgeText     :', data.badgeText);
            log('deepLink      :', data.deepLink);
            break;

        case 'battle_completed':
            log('question    :', data.question);
            log('winningSide :', data.winningSide);
            log('sideALabel  :', data.sideALabel, '| count:', data.sideACount);
            log('sideBLabel  :', data.sideBLabel, '| count:', data.sideBCount);
            log('accuracyText:', data.accuracyText);
            log('deepLink    :', data.deepLink);
            break;

        case 'battle_closed':
        case 'battle_result':
            log('battleId:', data.battleId);
            log('title   :', data.title);
            log('body    :', data.body);
            break;

        case 'battle_closing_soon':
            log('battleId     :', data.battleId);
            log('timeRemaining:', data.timeRemaining);
            log('sideALabel   :', data.sideALabel, '| count:', data.sideACount);
            log('sideBLabel   :', data.sideBLabel, '| count:', data.sideBCount);
            log('accuracyText :', data.accuracyText);
            break;

        case 'battle_forecast_missed':
            log('battleId          :', data.battleId);
            log('resultText        :', data.resultText);
            log('winningSide       :', data.winningSide);
            log('credibilityPenalty:', data.credibilityPenalty);
            log('accuracyRate      :', data.accuracyRate);
            log('encouragementText :', data.encouragementText);
            break;

        case 'drop_trending':
            log('postId           :', data.postId);
            log('dropTitle        :', data.dropTitle);
            log('actorUserName    :', data.actorUserName);
            log('reactionCount    :', data.reactionCount);
            log('commentCount     :', data.commentCount);
            log('views            :', data.views);
            log('totalInteractions:', data.totalInteractions);
            break;

        case 'post_comment':
            log('postId              :', data.postId);
            log('commentId           :', data.commentId);
            log('commenterUserName   :', data.commenterUserName);
            log('commenterDisplayName:', data.commenterDisplayName);
            log('commentPreview      :', data.commentPreview);
            log('postTitle           :', data.postTitle);
            break;

        case 'mention':
            log('postId              :', data.postId);
            log('contextType         :', data.contextType);
            log('mentionerUserName   :', data.mentionerUserName);
            log('mentionerDisplayName:', data.mentionerDisplayName);
            log('postTitle           :', data.postTitle);
            break;

        case 'story_view_insights':
            log('storyId        :', data.storyId);
            log('actorUserName  :', data.actorUserName);
            log('viewersLastHour:', data.viewersLastHour);
            log('viewsLast24h   :', data.viewsLast24h);
            log('reactions      :', data.reactions);
            log('profileVisits  :', data.profileVisits);
            break;

        case 'post_credit_low':
            log('userId          :', data.userId);
            log('creditsRemaining:', data.creditsRemaining);
            log('totalCredits    :', data.totalCredits);
            log('upgradePriceUsd :', data.upgradePriceUsd);
            break;

        case 'badge_achievement_unlocked':
            log('achievementCode :', data.achievementCode);
            log('achievementTitle:', data.achievementTitle);
            log('previousTier    :', data.previousTier);
            log('newTier         :', data.newTier);
            log('milestone       :', data.milestone);
            log('accuracyRate    :', data.accuracyRate);
            log('battlesWon      :', data.battlesWon);
            log('totalFollowers  :', data.totalFollowers);
            break;

        case 'mission_post_launched':
            log('postId            :', data.postId);
            log('creatorUserName   :', data.creatorUserName);
            log('missionTitle      :', data.missionTitle);
            log('goal              :', data.goal);
            log('deadline          :', data.deadline);
            log('backersCount      :', data.backersCount);
            log('platformFeePercent:', data.platformFeePercent);
            break;

        case 'mission_goal_milestone':
            log('postId         :', data.postId);
            log('creatorUserName:', data.creatorUserName);
            log('fundedPercent  :', data.fundedPercent);
            log('missionTitle   :', data.missionTitle);
            log('raised         :', data.raised);
            log('goal           :', data.goal);
            log('backersCount   :', data.backersCount);
            log('timeLeft       :', data.timeLeft);
            break;

        case 'mission_new_backer':
            log('postId        :', data.postId);
            log('backerUserName:', data.backerUserName);
            log('contribution  :', data.contribution);
            log('totalRaised   :', data.totalRaised);
            log('goal          :', data.goal);
            log('fundedPercent :', data.fundedPercent);
            log('backersCount  :', data.backersCount);
            log('timeLeft      :', data.timeLeft);
            break;

        case 'mission_ending_soon':
            log('postId         :', data.postId);
            log('creatorUserName:', data.creatorUserName);
            log('missionTitle   :', data.missionTitle);
            log('raised         :', data.raised);
            log('goal           :', data.goal);
            log('fundedPercent  :', data.fundedPercent);
            log('timeLeft       :', data.timeLeft);
            break;

        case 'mission_contribution_confirmed':
            log('postId         :', data.postId);
            log('creatorUserName:', data.creatorUserName);
            log('missionTitle   :', data.missionTitle);
            log('amountPaid     :', data.amountPaid);
            log('paymentVia     :', data.paymentVia);
            break;

        case 'private_circle_exclusive_post':
            log('postId            :', data.postId);
            log('privateCircleId   :', data.privateCircleId);
            log('creatorUserName   :', data.creatorUserName);
            log('exclusivePostTitle:', data.exclusivePostTitle);
            log('membersCount      :', data.membersCount);
            log('circleName        :', data.circleName);
            break;

        case 'private_circle_growing':
            log('privateCircleId:', data.privateCircleId);
            log('joinedUserName :', data.joinedUserName);
            log('totalMembers   :', data.totalMembers);
            log('activePosts    :', data.activePosts);
            log('circleName     :', data.circleName);
            break;

        case 'private_circle_access_removed':
            log('privateCircleId :', data.privateCircleId);
            log('ownerUserName   :', data.ownerUserName);
            log('ownerDisplayName:', data.ownerDisplayName);
            break;

        case 'welcome_onboarding':
            log('nextStep     :', data.nextStep);
            log('primaryAction:', data.primaryAction);
            log('expandedBody :', data.expandedBody);
            break;

        default:
            log('expandedTitle:', data.expandedTitle);
            log('expandedBody :', data.expandedBody);
            log('image_url    :', data.image_url);
            log('subtitle     :', data.subtitle);
            break;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {function} params.showNotificationToast
 * @param {function} params.setMessage  – setter from Main's useState
 */
const useNotificationSetup = ({ showNotificationToast, setMessage }) => {
    // Stable refs so callbacks never capture stale closures
    const showNotificationToastRef = useRef(showNotificationToast);
    const setMessageRef            = useRef(setMessage);

    useEffect(() => {
        showNotificationToastRef.current = showNotificationToast;
        setMessageRef.current            = setMessage;
    }, [showNotificationToast, setMessage]);

    useEffect(() => {
        console.log('[NOTIF] 🔧 Registering notification listeners (once)');

        // Create channels on Android (no-op on iOS)
        createNotificationChannels();

        // ── Restore notification that arrived while app was killed ─────────────
        const showPendingNotifeeNotification = async () => {
            try {
                const raw = await AsyncStorage.getItem(PENDING_NOTIFICATION_MODAL_KEY);
                if (!raw) {
                    console.log('[NOTIF] 📭 No pending notifee notification in storage');
                    return;
                }
                console.log('[NOTIF] 📬 Found pending notifee notification:', raw);
                await AsyncStorage.removeItem(PENDING_NOTIFICATION_MODAL_KEY);
                const parsed = JSON.parse(raw);
                console.log('[NOTIF] ✅ Parsed pending notification:', JSON.stringify(parsed, null, 2));
                showNotificationToastRef.current(parsed);
            } catch (error) {
                console.log('[NOTIF] ❌ Failed to parse pending notification:', error?.message || error);
            }
        };

        // ── FOREGROUND FCM ─────────────────────────────────────────────────────
        // Receives messages when the app is in the foreground.
        // Background + quit-state messages are handled by registerBackgroundHandler
        // in index.js — do NOT register messaging().onMessage here for those.
        const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
            console.log('[NOTIF] 🟢 ──────────────────────────────────────────');
            console.log('[NOTIF] 🟢 FOREGROUND MESSAGE RECEIVED');
            console.log('[NOTIF] 🟢 ──────────────────────────────────────────');
            console.log('[NOTIF] 🟢 Full payload:', JSON.stringify(remoteMessage, null, 2));

            const title  = remoteMessage?.notification?.title ?? remoteMessage?.data?.title;
            const body   = remoteMessage?.notification?.body  ?? remoteMessage?.data?.body;
            const type   = remoteMessage?.data?.type ?? '(no type)';
            const msgId  = remoteMessage?.messageId ?? remoteMessage?.collapseKey ?? '(no id)';
            const sentAt = remoteMessage?.sentTime
                ? new Date(remoteMessage.sentTime).toISOString()
                : '(no sentTime)';

            console.log('[NOTIF] 🟢 messageId  :', msgId);
            console.log('[NOTIF] 🟢 sentTime   :', sentAt);
            console.log('[NOTIF] 🟢 type       :', type);
            console.log('[NOTIF] 🟢 title      :', title);
            console.log('[NOTIF] 🟢 body       :', body);
            console.log('[NOTIF] 🟢 data       :', JSON.stringify(remoteMessage?.data, null, 2));

            logTypedNotification('🟢', remoteMessage?.data, type);

            // Display rich local notification (foreground FCM doesn't auto-display)
            try {
                await displayFcmAsExpandable(remoteMessage);
                console.log('[NOTIF] 🟢 ✅ displayFcmAsExpandable completed');
            } catch (err) {
                console.error('[NOTIF] 🟢 ❌ displayFcmAsExpandable failed:', err?.message || err);
            }

            // Show in-app toast banner
            try {
                showNotificationToastRef.current(remoteMessage);
                console.log('[NOTIF] 🟢 ✅ showNotificationToast completed');
            } catch (err) {
                console.error('[NOTIF] 🟢 ❌ showNotificationToast failed:', err?.message || err);
            }
        });

        // ── BACKGROUND TAP (app in background, user taps notification) ────────
        const unsubscribeOnNotificationOpened = messaging().onNotificationOpenedApp(remoteMessage => {
            console.log('[NOTIF] 🟡 BACKGROUND TAP');
            const body = remoteMessage?.notification?.body ?? remoteMessage?.data?.body ?? '';
            setMessageRef.current(body);
            showNotificationToastRef.current(remoteMessage);
        });

        // ── QUIT-STATE TAP (app was killed, user taps notification) ───────────
        // This fires once on app launch if the app was opened via a notification.
        messaging().getInitialNotification().then(remoteMessage => {
            if (remoteMessage) {
                console.log('[NOTIF] 🔴 QUIT STATE TAP');
                const body = remoteMessage?.notification?.body ?? remoteMessage?.data?.body ?? '';
                setMessageRef.current(body);
                showNotificationToastRef.current(remoteMessage);
            }
        });

        // ── Restore any notifee notification tapped while app was killed ───────
        showPendingNotifeeNotification();

        // ── NOTIFEE FOREGROUND ────────────────────────────────────────────────
        // Handles taps/dismissals on local (notifee-displayed) notifications
        // while the app is in the foreground.
        const unsubscribeNotifeeForeground = notifee.onForegroundEvent(({ type, detail }) => {
            console.log('[NOTIF] 🔔 NOTIFEE FOREGROUND EVENT');
            console.log('[NOTIF] 🔔 Event type:', type, '— (1=Press, 2=Dismiss, 3=Action)');
            console.log('[NOTIF] 🔔 Title:', detail?.notification?.title);
            console.log('[NOTIF] 🔔 Body:', detail?.notification?.body);
            console.log('[NOTIF] 🔔 Data:', JSON.stringify(detail?.notification?.data, null, 2));

            if (type === EventType.PRESS && detail?.notification) {
                console.log('[NOTIF] 🔔 User PRESSED notifee notification — showing toast');
                showNotificationToastRef.current({
                    notification: {
                        title: detail.notification?.title,
                        body:  detail.notification?.body,
                    },
                    data: detail.notification?.data || {},
                });
            } else if (type === EventType.DISMISSED) {
                console.log('[NOTIF] 🔔 User DISMISSED notifee notification');
            }
        });

        return () => {
            console.log('[NOTIF] 🧹 Cleaning up notification listeners');
            unsubscribeOnMessage();
            unsubscribeOnNotificationOpened();
            unsubscribeNotifeeForeground();
        };
        // Intentionally empty deps — register once, use stable refs inside
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
};

export default useNotificationSetup;