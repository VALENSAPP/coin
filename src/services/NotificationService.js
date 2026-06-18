// notificationService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidStyle, AndroidImportance, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';

export const PENDING_NOTIFICATION_MODAL_KEY = 'pendingNotificationModal';

const buildModalNotificationPayload = (notification = {}) => ({
    notification: {
        title: notification?.title,
        body: notification?.body,
    },
    data: notification?.data || {},
});

// ─────────────────────────────────────────────
// PERMISSION
// ─────────────────────────────────────────────
export async function requestUserPermission() {
    const authStatus = await messaging().requestPermission();
    const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
        console.log('Authorization status:', authStatus);
        getFcmToken();
    } else {
        console.log('authStatus not enabled------------');
    }
}

// ─────────────────────────────────────────────
// TOKEN
// ─────────────────────────────────────────────
const getFcmToken = async () => {
    console.log('Checking for existing FCM token...');
    let fcmToken = await AsyncStorage.getItem('fcmToken');
    console.log(fcmToken, 'the old token');

    if (!fcmToken) {
        try {
            const token = await messaging().getToken();
            if (token) {
                console.log(token, 'the new generated token');
                await AsyncStorage.setItem('fcmToken', token);
            }
        } catch (error) {
            console.log(error, 'error raised in fcmtoken');
        }
    }
};

// ─────────────────────────────────────────────
// NOTIFEE CHANNEL SETUP (Android only — call once at app start)
// ─────────────────────────────────────────────
export const createNotificationChannels = async () => {
    await notifee.createChannel({
        id: 'default',
        name: 'Default Notifications',
        importance: AndroidImportance.HIGH,
    });

    await notifee.createChannel({
        id: 'expandable',
        name: 'Expandable Notifications',
        importance: AndroidImportance.HIGH,
    });
};

// ─────────────────────────────────────────────
// DISPLAY EXPANDABLE NOTIFICATION (local)
// ─────────────────────────────────────────────
export const displayExpandableNotification = async ({
    notifId,
    title,
    body,
    bigText,
    bigTitle,
    imageUrl,
    subtitle,
    data = {},
    androidStyle: customStyle,
}) => {
    console.log('[NOTIFEE] 🚀 displayExpandableNotification called');
    console.log('[NOTIFEE] id:', notifId, '| title:', title, '| body:', body);
    console.log('[NOTIFEE] customStyle:', customStyle ? customStyle.type : '(none)');

    let androidStyle = customStyle;

    const iosAttachments = [];
    if (Platform.OS === 'ios' && imageUrl) {
        iosAttachments.push({
            id: 'main-image',
            url: imageUrl,  // must be HTTPS
        });
    }

    const iosSummary = androidStyle?.lines
        ? androidStyle.lines.join('\n')
        : (bigText || body);

    if (!androidStyle) {
        if (imageUrl) {
            androidStyle = {
                type: AndroidStyle.BIGPICTURE,
                picture: imageUrl,
                largeIcon: imageUrl,
                title: bigTitle ?? title,
                summary: bigText ?? body,
            };
            console.log('[NOTIFEE] Using BigPictureStyle');
        } else if (bigText) {
            androidStyle = {
                type: AndroidStyle.BIGTEXT,
                text: bigText,
                title: bigTitle ?? title,
                summary: body,
            };
            console.log('[NOTIFEE] Using BigTextStyle');
        } else {
            console.log('[NOTIFEE] Plain notification — no style');
        }
    }

    try {
        await notifee.displayNotification({
            ...(notifId && { id: notifId }),
            title,
            body: iosSummary,
            subtitle: subtitle ?? bigTitle,
            data,
            android: {
                channelId: 'expandable',
                importance: AndroidImportance.HIGH,
                pressAction: { id: 'default' },
                ...(androidStyle && { style: androidStyle }),
            },
            ios: {
                sound: 'default',
                ...(subtitle && { subtitle }),
                ...(iosAttachments.length > 0 && { attachments: iosAttachments }),
                threadId: 'expandable-group',
                foregroundPresentationOptions: {
                    alert: true,
                    badge: true,
                    sound: true,
                },
            },
        });
        console.log('[NOTIFEE] ✅ Notification displayed successfully');
    } catch (error) {
        console.error('[NOTIFEE] ❌ Failed to display notification:', error?.message || error);
    }
};

// ─────────────────────────────────────────────
// BUILD EXPANDABLE FROM FCM MESSAGE
// ─────────────────────────────────────────────
export const displayFcmAsExpandable = async (remoteMessage) => {
    const { notification, data } = remoteMessage;
    if (!data) return;

    // Stable ID derived from FCM messageId — used to prevent duplicate
    // notifications and to cancel the plain OS-delivered copy if needed
    const notifId = remoteMessage.messageId
        ? `fcm_${remoteMessage.messageId}`
        : `fcm_${Date.now()}`;

    const type = data?.type || '';
    const fcmTitle = notification?.title ?? data?.title ?? '';
    const fcmBody = notification?.body ?? data?.body ?? '';

    console.log('[NOTIF] 🎨 Building expandable for type:', type, '| notifId:', notifId);

    let title = '', body = '', bigText = '', bigTitle = '', subtitle = '';
    let imageUrl;
    let androidStyle;

    if (type === 'follow') {
        // ── NEW FOLLOWER ──────────────────────────────────────────────────
        title = data?.expandedTitle ?? fcmTitle ?? 'New Follower';
        body = fcmBody ?? `${data?.followerDisplayName} started following you`;
        bigText = data?.expandedBody ?? body;
        bigTitle = data?.expandedTitle ?? title;
        imageUrl = data?.followerImage ?? data?.image_url;
        subtitle = data?.followerDisplayName;

        const followerName = data?.followerDisplayName || data?.followerUserName || '';
        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                ...(followerName ? [`${followerName} is now following you`] : []),
                ...(data?.followerTotalFollowers ? [`Their followers: ${data.followerTotalFollowers}`] : []),
                ...(data?.followerAccuracyRate ? [`Credibility rate: ${data.followerAccuracyRate}%`] : []),
                `[ View Profile ]`,
            ],
            title: data?.expandedTitle ?? 'NEW FOLLOWER',
            summary: body,
        };

    } else if (type === 'battle_invite') {
        // ── BATTLE INVITE ─────────────────────────────────────────────────
        const endDate = data?.endTime ? new Date(data.endTime) : null;
        const hoursLeft = endDate
            ? Math.max(0, Math.round((endDate - Date.now()) / 3_600_000))
            : null;

        title = data?.title ?? 'Battle Invitation';
        body = data?.body ?? `${data?.inviterUserName} invited you to a Battle`;
        bigTitle = 'BATTLE INVITATION';
        subtitle = data?.inviterUserName;

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `Topic:`,
                `"${data?.question}"`,
                `Forecast by ${data?.inviterUserName}:  ${data?.challengerSide}`,
                `Argument: ${data?.challengerArgument}`,
                `Battle ends in: ${hoursLeft ?? '?'}h  |  Participants: ${data?.participantCount ?? '?'}`,
            ],
            title: 'BATTLE INVITATION',
            summary: body,
        };

    } else if (type === 'battle_started') {
        const endDate = data?.endTime ? new Date(data.endTime) : null;

        const timeLeft = endDate
            ? (() => {
                const mins = Math.round((endDate - Date.now()) / 60_000);
                if (mins <= 0) return 'ended';
                if (mins < 60) return `${mins}m`;
                return `${Math.round(mins / 60)}h`;
            })()
            : '?';

        const sideALabel = data?.sideALabel ?? 'Side A';
        const sideBLabel = data?.sideBLabel ?? 'Side B';
        const sideACount = data?.sideACount ?? '0';
        const sideBCount = data?.sideBCount ?? '0';
        const question = data?.question ?? '';

        title = data?.expandedTitle ?? fcmTitle ?? '⚔️ Battle Started';
        body = data?.body ?? fcmBody ?? 'The debate is live. See who joins your side.';

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `Topic: "${question}"`,
                `🟢 ${sideALabel}  👥 ${sideACount}`,
                `🔴 ${sideBLabel}  👥 ${sideBCount}`,
                `⏱ Ends in: ${timeLeft}`,
                `[ View Discussion ]`,
            ],
            title: data?.expandedTitle ?? '⚔️ Battle Started',
            summary: body,
        };

    } else if (type === 'battle_victory') {
        // ── BATTLE VICTORY ────────────────────────────────────────────────
        const credibility = data?.credibilityGain ? `+${data.credibilityGain}` : null;
        const accuracy = data?.accuracyRate ? `${data.accuracyRate}%` : null;

        title = data?.expandedTitle ?? fcmTitle ?? '🏆 Victory!';
        body = data?.body ?? fcmBody ?? 'Your side won!';

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `🏆 You chose the winning side!`,
                `"${data?.resultText ?? ''}"`,
                ...(credibility ? [`⬆️ Credibility: ${credibility} pts`] : []),
                ...(accuracy ? [`🎯 Accuracy Rate: ${accuracy}`] : []),
                ...(data?.badgeText ? [`🏅 ${data.badgeText}`] : []),
                `[ View Achievements ]`,
            ],
            title: data?.expandedTitle ?? '🏆 VICTORY!',
            summary: body,
        };

    } else if (type === 'battle_completed') {
        // ── BATTLE COMPLETED ──────────────────────────────────────────────
        const sideALabel = data?.sideALabel ?? 'Side A';
        const sideBLabel = data?.sideBLabel ?? 'Side B';
        const sideACount = data?.sideACount ?? '0';
        const sideBCount = data?.sideBCount ?? '0';
        const winningSide = data?.winningSide ?? '';
        const question = data?.question ?? '';

        const sideAPrefix = winningSide === sideALabel ? '🏆' : '  ';
        const sideBPrefix = winningSide === sideBLabel ? '🏆' : '  ';

        title = data?.expandedTitle ?? fcmTitle ?? '🏆 Battle Completed';
        body = data?.body ?? fcmBody ?? 'See the final outcome.';

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `Topic: "${question}"`,
                `${sideAPrefix} ${sideALabel}  👥 ${sideACount}`,
                `${sideBPrefix} ${sideBLabel}  👥 ${sideBCount}`,
                ...(data?.accuracyText ? [`🎯 ${data.accuracyText}`] : []),
                `[ View Results ]`,
            ],
            title: data?.expandedTitle ?? '🏆 BATTLE RESULT',
            summary: body,
        };

    } else if (type === 'battle_closed') {
        // ── BATTLE CLOSED (observer / follower) ───────────────────────────
        title = fcmTitle ?? data?.title ?? 'Battle Closed';
        body = fcmBody ?? data?.body ?? 'A battle you follow has ended.';
        bigText = body;
        bigTitle = title;

    } else if (type === 'battle_result') {
        // ── BATTLE RESULT (generic result notification) ───────────────────
        title = fcmTitle ?? data?.title ?? 'Battle Result';
        body = fcmBody ?? data?.body ?? 'Your battle has ended. Check the results.';
        bigText = body;
        bigTitle = title;

    } else if (type === 'battle_closing_soon') {
        // ── BATTLE CLOSING SOON ───────────────────────────────────────────
        const sideALabel = data?.sideALabel ?? 'Agree with Forecast';
        const sideBLabel = data?.sideBLabel ?? 'Challenge Forecast';
        const sideACount = data?.sideACount ?? '0';
        const sideBCount = data?.sideBCount ?? '0';
        const timeRemaining = data?.timeRemaining ?? '?';

        title = fcmTitle ?? data?.title ?? '⏳ Battle Closing Soon';
        body = fcmBody ?? data?.body ?? 'Final votes are coming in. See the current outcome before time runs out.';

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `Time Remaining:  ${timeRemaining}`,
                `${sideALabel}:  ${sideACount}`,
                `${sideBLabel}:  ${sideBCount}`,
                ...(data?.accuracyText ? [`${data.accuracyText}`] : [`Accuracy impact pending.`]),
                `[ View Battle ]`,
            ],
            title: data?.expandedTitle ?? 'BATTLE ENDING SOON',
            summary: body,
        };

    } else if (type === 'battle_forecast_missed') {
        // ── BATTLE FORECAST MISSED (loss) ─────────────────────────────────
        const credibility = data?.credibilityPenalty ? `-${data.credibilityPenalty}` : null;
        const accuracy = data?.accuracyRate ? `${data.accuracyRate}%` : null;

        title = fcmTitle ?? data?.title ?? 'Battle Result Updated';
        body = fcmBody ?? data?.body ?? 'The outcome did not match your forecast. Review your accuracy.';

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `${data?.resultText ?? 'Your side did not win this Battle.'}`,
                ...(credibility ? [`Credibility Score:  ${credibility}`] : []),
                ...(accuracy ? [`Accuracy Rate Updated:  ${accuracy}`] : []),
                ...(data?.encouragementText ? [`${data.encouragementText}`] : [`Keep forecasting to improve your rank.`]),
                `[ Start a New Battle ]`,
            ],
            title: data?.expandedTitle ?? 'BATTLE RESULT',
            summary: body,
        };

    } else if (type === 'drop_trending') {
        // ── DROP TRENDING ─────────────────────────────────────────────────
        const reactionCount = data?.reactionCount ?? '0';
        const commentCount = data?.commentCount ?? '0';
        const views = data?.views ?? '0';

        title = fcmTitle ?? data?.title ?? '🎬 Your Drop is trending!';
        body = fcmBody ?? data?.body ?? `${data?.actorUserName} and others reacted to your Drop. It's getting traction!`;

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `Your Drop: "${data?.dropTitle ?? ''}"`,
                `👍 Reactions:  ${reactionCount}`,
                `💬 Comments:  ${commentCount}`,
                `👁 Views:  ${views}`,
                `[ View Drop ]`,
            ],
            title: data?.expandedTitle ?? 'DROP TRENDING',
            summary: body,
        };

    } else if (type === 'post_comment') {
        // ── NEW COMMENT ───────────────────────────────────────────────────
        const commenter = data?.commenterUserName ?? data?.commenterDisplayName ?? 'Someone';
        const preview = data?.commentPreview ?? '';
        const postTitle = data?.postTitle ?? '';

        title = fcmTitle ?? data?.title ?? '💬 New Comment';
        body = fcmBody ?? data?.body ?? `${commenter} commented on your post`;

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `${commenter} commented on your post:`,
                ...(preview ? [`"${preview}"`] : []),
                ...(postTitle ? [`Post: "${postTitle}"`] : []),
                `[ Reply ]     [ View Post ]`,
            ],
            title: data?.expandedTitle ?? 'NEW COMMENT',
            summary: body,
        };

    } else if (type === 'mention') {
        // ── MENTION ───────────────────────────────────────────────────────
        const mentioner = data?.mentionerUserName ?? data?.mentionerDisplayName ?? 'Someone';
        const contextType = data?.contextType ?? 'post';
        const postTitle = data?.postTitle ?? '';

        title = fcmTitle ?? data?.title ?? '📣 You were mentioned!';
        body = fcmBody ?? data?.body ?? `${mentioner} mentioned you in a ${contextType}.`;

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `${mentioner} mentioned you in a ${contextType}.`,
                ...(postTitle ? [`Post: "${postTitle}"`] : []),
                `[ View Context ]`,
            ],
            title: data?.expandedTitle ?? 'YOU WERE MENTIONED',
            summary: body,
        };

    } else if (type === 'story_view_insights') {
        // ── STORY VIEW INSIGHTS ───────────────────────────────────────────
        const viewsLast24h = data?.viewsLast24h ?? '0';
        const reactions = data?.reactions ?? '0';
        const profileVisits = data?.profileVisits ?? '0';

        title = fcmTitle ?? data?.title ?? '👁 Your Story is Popular!';
        body = fcmBody ?? data?.body ?? `${data?.actorUserName} and others viewed your Story in the last hour.`;

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `Views (last 24h):  ${viewsLast24h}`,
                `Reactions:  ${reactions}`,
                `Profile Visits:  ${profileVisits}`,
                `[ View Story Analytics ]`,
            ],
            title: data?.expandedTitle ?? 'STORY INSIGHTS',
            summary: body,
        };

    } else if (type === 'post_credit_low') {
        // ── LOW POST CREDITS ──────────────────────────────────────────────
        const creditsRemaining = data?.creditsRemaining ?? '1';
        const totalCredits = data?.totalCredits ?? '5';
        const upgradePrice = data?.upgradePriceUsd ?? '1.99';

        title = fcmTitle ?? data?.title ?? '⚠ 1 Post Credit Left';
        body = fcmBody ?? data?.body ?? 'You have 1 free post credit remaining this month. Upgrade to keep posting.';

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `Credits Remaining:  ${creditsRemaining} / ${totalCredits}`,
                `Upgrade to Valens Pro for $${upgradePrice}/month`,
                `Unlimited posts + premium analytics`,
                `[ Upgrade Now ]`,
                `[ Continue with Free Plan ]`,
            ],
            title: data?.expandedTitle ?? 'LOW POST CREDITS',
            summary: body,
        };

    } else if (type === 'badge_achievement_unlocked') {
        // ── BADGE / ACHIEVEMENT UNLOCKED ──────────────────────────────────
        const previousTier = data?.previousTier ?? '';
        const newTier = data?.newTier ?? '';
        const milestone = data?.milestone ?? '';
        const accuracyRate = data?.accuracyRate ? `${data.accuracyRate}%` : null;
        const battlesWon = data?.battlesWon ?? null;
        const achievementTitle = data?.achievementTitle ?? 'Achievement Unlocked';

        title = fcmTitle ?? data?.title ?? '🥇 New Badge Unlocked!';
        body = fcmBody ?? data?.body ?? 'You unlocked a new achievement!';

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `${achievementTitle}`,
                ...(previousTier && newTier ? [`${previousTier}  →  ${newTier}`] : []),
                ...(milestone ? [`Milestone:  ${milestone}`] : []),
                ...(accuracyRate ? [`Accuracy Rate: ${accuracyRate}`] : []),
                ...(battlesWon ? [`Battles Won:  ${battlesWon}`] : []),
                `[ View Profile ]`,
            ],
            title: data?.expandedDisplayTitle ?? 'ACHIEVEMENT UNLOCKED',
            summary: body,
        };

    } else if (type === 'mission_post_launched') {
        // ── MISSION POST LAUNCHED ─────────────────────────────────────────
        const creator = data?.creatorUserName ?? data?.creatorDisplayName ?? 'Someone';
        const missionTitle = data?.missionTitle ?? '';
        const goal = data?.goal ? `$${data.goal}` : null;
        const backersCount = data?.backersCount ?? '0';
        const platformFee = data?.platformFeePercent ?? '5';

        let deadlineText = '';
        if (data?.deadline) {
            try {
                const deadlineDate = new Date(data.deadline);
                const daysLeft = Math.max(0, Math.round((deadlineDate - Date.now()) / 86_400_000));
                const dateStr = deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                deadlineText = `${daysLeft} days  (ends ${dateStr})`;
            } catch (_) {
                deadlineText = data.deadline;
            }
        }

        title = fcmTitle ?? data?.title ?? `🎯 ${creator} launched a Mission!`;
        body = fcmBody ?? data?.body ?? 'They need your support. See the goal and be one of the first backers.';

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `${creator} just launched a Mission`,
                `Mission Title:`,
                ...(missionTitle ? [`"${missionTitle}"`] : []),
                ...(goal ? [`Goal:  ${goal}`] : []),
                ...(deadlineText ? [`Deadline:  ${deadlineText}`] : []),
                `Backers so far:  ${backersCount}  —  Be the first!`,
                `Platform fee: ${platformFee}%  |  Powered by Valens`,
                `[ Back This Mission ]     [ View Full Post ]`,
            ],
            title: data?.expandedTitle ?? 'NEW MISSION POST',
            summary: body,
        };

    } else if (type === 'mission_goal_milestone') {
        // ── MISSION GOAL MILESTONE ────────────────────────────────────────
        const fundedPercent = data?.fundedPercent ?? data?.milestone ?? '25';
        const missionTitle = data?.missionTitle ?? '';
        const raised = data?.raised ? `$${data.raised}` : null;
        const goal = data?.goal ? `$${data.goal}` : null;
        const backersCount = data?.backersCount ?? '0';
        const timeLeft = data?.timeLeft ?? '';

        title = fcmTitle ?? data?.title ?? `📈 Mission is ${fundedPercent}% funded!`;
        body = fcmBody ?? data?.body ?? `Campaign just hit the ${fundedPercent}% milestone!`;

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                ...(missionTitle ? [`"${missionTitle}"`] : []),
                ...(raised && goal ? [`Raised:  ${raised} of ${goal}`] : []),
                `Backers:  ${backersCount}`,
                ...(timeLeft ? [`Time Left: ${timeLeft}`] : []),
                `[ Back This Mission ]     [ Share ]`,
            ],
            title: data?.expandedTitle ?? 'MISSION MILESTONE',
            summary: `${fundedPercent}% Funded!`,
        };

    } else if (type === 'mission_new_backer') {
        // ── MISSION NEW BACKER ────────────────────────────────────────────
        const backer = data?.backerUserName ?? data?.backerDisplayName ?? 'Someone';
        const contribution = data?.contribution ? `$${data.contribution}` : null;
        const totalRaised = data?.totalRaised ? `$${data.totalRaised}` : null;
        const goal = data?.goal ? `$${data.goal}` : null;
        const fundedPercent = data?.fundedPercent ?? '';
        const backersCount = data?.backersCount ?? '0';
        const timeLeft = data?.timeLeft ?? '';

        title = fcmTitle ?? data?.title ?? '🏦 New Backer on your Mission!';
        body = fcmBody ?? data?.body ?? `${backer} contributed to your Mission.`;

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `${backer} backed your Mission!`,
                ...(contribution ? [`Contribution:  ${contribution}`] : []),
                ...(totalRaised && goal ? [`Total Raised:  ${totalRaised} of ${goal}${fundedPercent ? ` (${fundedPercent}%)` : ''}`] : []),
                `Total Backers:  ${backersCount}`,
                ...(timeLeft ? [`Time Left:  ${timeLeft}`] : []),
                `[ View Your Mission ]     [ Send Thanks ]`,
            ],
            title: data?.expandedTitle ?? 'NEW BACKER',
            summary: body,
        };

    } else if (type === 'mission_ending_soon') {
        // ── MISSION ENDING SOON ───────────────────────────────────────────
        const creator = data?.creatorUserName ?? data?.creatorDisplayName ?? 'Someone';
        const missionTitle = data?.missionTitle ?? '';
        const raised = data?.raised ? `$${data.raised}` : null;
        const goal = data?.goal ? `$${data.goal}` : null;
        const fundedPercent = data?.fundedPercent ?? '';
        const timeLeft = data?.timeLeft ?? '24 hours';

        let stillNeeded = null;
        if (data?.raised && data?.goal) {
            const needed = parseFloat(data.goal) - parseFloat(data.raised);
            if (needed > 0) stillNeeded = `$${needed.toFixed(2)} in ${timeLeft}`;
        }

        title = fcmTitle ?? data?.title ?? '⏳ Mission ends in 24h!';
        body = fcmBody ?? data?.body ?? `${creator}'s campaign closes soon. Final chance to support and share.`;

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `Mission ends in ${timeLeft}`,
                ...(missionTitle ? [`"${missionTitle}"`] : []),
                ...(raised && goal ? [`Raised:  ${raised} of ${goal}${fundedPercent ? ` (${fundedPercent}%)` : ''}`] : []),
                ...(stillNeeded ? [`Still needed:  ${stillNeeded}`] : []),
                `[ Back This Mission Now ]     [ Share ]`,
            ],
            title: data?.expandedTitle ?? 'LAST CHANCE',
            summary: body,
        };

    } else if (type === 'mission_contribution_confirmed') {
        // ── MISSION CONTRIBUTION CONFIRMED ────────────────────────────────
        const creator = data?.creatorUserName ?? data?.creatorDisplayName ?? 'Someone';
        const missionTitle = data?.missionTitle ?? '';
        const amountPaid = data?.amountPaid ? `$${data.amountPaid}` : null;
        const paymentVia = data?.paymentVia ?? 'Stripe';

        title = fcmTitle ?? data?.title ?? '✅ Contribution Confirmed!';
        body = fcmBody ?? data?.body ?? `Your backing of ${creator}'s Mission is confirmed. Thank you!`;

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `Your backing was successful!`,
                ...(missionTitle ? [`Mission: "${missionTitle}"`] : []),
                `Creator:  ${creator}`,
                ...(amountPaid ? [`Amount Paid:  ${amountPaid}`] : []),
                `Payment via:  ${paymentVia}`,
                `You will be notified when the goal is reached.`,
                `[ View Mission Progress ]     [ Share ]`,
            ],
            title: data?.expandedTitle ?? 'CONTRIBUTION CONFIRMED',
            summary: body,
        };

    } else if (type === 'private_circle_exclusive_post') {
        // ── PRIVATE CIRCLE EXCLUSIVE POST ─────────────────────────────────
        const creator = data?.creatorUserName ?? data?.creatorDisplayName ?? 'Someone';
        const postTitle = data?.exclusivePostTitle ?? '';
        const membersCount = data?.membersCount ?? '';
        const circleName = data?.circleName ?? 'Private Circle';

        title = fcmTitle ?? data?.title ?? '🔐 New exclusive post in your Circle!';
        body = fcmBody ?? data?.body ?? `${creator} just posted exclusive content for your Private Circle.`;

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `Only visible to Circle members`,
                `${creator} posted:`,
                ...(postTitle ? [`"${postTitle}"`] : []),
                ...(circleName ? [`Posted to:  ${circleName}`] : []),
                ...(membersCount ? [`Members:  ${membersCount}  |  Visible to Circle only`] : []),
                `[ View Exclusive Post ]`,
            ],
            title: 'EXCLUSIVE CIRCLE POST',
            summary: body,
        };

    } else if (type === 'private_circle_growing') {
        // ── PRIVATE CIRCLE GROWING ────────────────────────────────────────
        const newMember = data?.joinedUserName ?? data?.joinedUserDisplayName ?? 'Someone';
        const totalMembers = data?.totalMembers ?? '0';
        const activePosts = data?.activePosts ?? '0';
        const circleName = data?.circleName ?? 'Private Circle';

        title = fcmTitle ?? data?.title ?? '📈 Your Private Circle is growing!';
        body = fcmBody ?? data?.body ?? `${newMember} just joined your Private Circle. You now have ${totalMembers} members.`;

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `${newMember} joined your Private Circle!`,
                ...(circleName ? [`Circle: "${circleName}"`] : []),
                `Total Members:  ${totalMembers}`,
                `Active Posts:  ${activePosts} exclusive post${activePosts !== '1' ? 's' : ''}`,
                `[ Manage Circle Members ]     [ Post Exclusive Content ]`,
            ],
            title: 'CIRCLE GROWING',
            summary: body,
        };

    } else if (type === 'private_circle_access_removed') {
        // ── PRIVATE CIRCLE ACCESS REMOVED ─────────────────────────────────
        const owner = data?.ownerUserName ?? data?.ownerDisplayName ?? 'Someone';

        title = fcmTitle ?? data?.title ?? '🚫 Access Removed';
        body = fcmBody ?? data?.body ?? `You have been removed from ${owner}'s Private Circle.`;

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `You have been removed from:`,
                `${owner}'s Private Circle`,
                `Exclusive posts from this Circle are no longer visible.`,
                `You can still follow ${owner} for public content.`,
                `[ View ${owner}'s Profile ]`,
            ],
            title: 'CIRCLE ACCESS REMOVED',
            summary: body,
        };

    } else if (type === 'welcome_onboarding') {
        // ── WELCOME / ONBOARDING ──────────────────────────────────────────
        title = fcmTitle ?? data?.title ?? '🚀 Welcome to Valens!';
        body = fcmBody ?? data?.body ?? 'Your profile is live. Start posting, join Battles, and grow your following today!';

        androidStyle = {
            type: AndroidStyle.INBOX,
            lines: [
                `Your profile is live and ready.`,
                `Free Post Credits:  5`,
                `Dralens Tier:  White`,
                `Battles Available:  Unlimited`,
                `[ Set Up Your Profile ]`,
                `[ Start a Battle ]`,
                `[ Explore Creators ]`,
            ],
            title: 'WELCOME TO VALENS!',
            summary: body,
        };

    } else {
        // ── FALLBACK ──────────────────────────────────────────────────────
        title = data?.expandedTitle ?? fcmTitle ?? 'Notification';
        body = fcmBody ?? data?.expandedBody ?? '';
        bigText = data?.expandedBody ?? body;
        bigTitle = data?.expandedTitle ?? title;
        imageUrl = data?.image_url;
        subtitle = data?.subtitle;
    }

    console.log('[NOTIF] 🎨 Final → title:', title);
    console.log('[NOTIF] 🎨 Final → body:', body);
    console.log('[NOTIF] 🎨 Final → androidStyle type:', androidStyle?.type ?? 'none (using bigText/imageUrl)');

    await displayExpandableNotification({
        notifId,
        title,
        body,
        bigText,
        bigTitle,
        imageUrl,
        subtitle,
        data,
        androidStyle,
    });
};

// ─────────────────────────────────────────────
// BACKGROUND HANDLER
// Must be called in index.js BEFORE AppRegistry.registerComponent
// ─────────────────────────────────────────────

export const registerBackgroundHandler = () => {
    messaging().setBackgroundMessageHandler(async remoteMessage => {
        console.log('[NOTIF] ⚫ BACKGROUND HANDLER FIRED', Platform.OS);

        // ── iOS: cancel any OS-delivered duplicate, then show our rich version
        // (same as Android — Notifee works in background on iOS too)
        try {
            const displayed = await notifee.getDisplayedNotifications();
            await Promise.all(displayed.map(n => notifee.cancelNotification(n.id)));
        } catch (e) {
            console.log('[NOTIF] ⚫ Pre-clear error:', e?.message);
        }

        await displayFcmAsExpandable(remoteMessage);

        // Clean up duplicates after ours is posted
        if (remoteMessage.messageId) {
            try {
                await new Promise(resolve => setTimeout(resolve, 800));
                const ourId = `fcm_${remoteMessage.messageId}`;
                const displayed = await notifee.getDisplayedNotifications();
                await Promise.all(
                    displayed
                        .filter(n => n.id !== ourId)
                        .map(n => notifee.cancelNotification(n.id))
                );
            } catch (e) {
                console.log('[NOTIF] ⚫ Post-cancel error:', e?.message);
            }
        }
    });

    notifee.onBackgroundEvent(async ({ type, detail }) => {
        console.log('[NOTIF] ⚫ NOTIFEE BACKGROUND EVENT type:', type);
        if (type === EventType.PRESS && detail?.notification) {
            await AsyncStorage.setItem(
                PENDING_NOTIFICATION_MODAL_KEY,
                JSON.stringify(buildModalNotificationPayload(detail.notification)),
            );
        }
    });
};