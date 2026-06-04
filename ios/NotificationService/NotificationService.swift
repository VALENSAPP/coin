import UserNotifications

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    if request.trigger is UNPushNotificationTrigger == false {
    // This is a local notification (from notifee) — don't modify it
    contentHandler(request.content)
    return
}

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttemptContent  = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let content = bestAttemptContent else {
            contentHandler(request.content)
            return
        }

        let data = request.content.userInfo

        let type          = data["type"]          as? String ?? ""
        let imageUrl      = data["image_url"]     as? String
                         ?? data["followerImage"] as? String
        let expandedTitle = data["expandedTitle"] as? String
        let expandedBody  = data["expandedBody"]  as? String

        let lines = buildLines(type: type, data: data)

        if !lines.isEmpty {
            // Use expandedTitle as the notification title if provided
            if let et = expandedTitle { content.title = et }

            // Join ALL lines into the body — iOS expands on long-press automatically
            content.subtitle = ""
            content.body     = lines.joined(separator: "\n")

        } else if let expBody = expandedBody {
            // BigText fallback
            if let et = expandedTitle { content.title = et }
            content.body = expBody
        }
        // else: leave title/body exactly as sent by APNs (from notification.title/body in FCM)

        // Attach image if present
        if let urlString = imageUrl, let url = URL(string: urlString) {
            downloadImage(from: url, content: content) { finalContent in
                contentHandler(finalContent)
            }
        } else {
            contentHandler(content)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        if let contentHandler, let bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // MARK: Build lines per notification type
    // ─────────────────────────────────────────────────────────────────────

    private func buildLines(type: String, data: [AnyHashable: Any]) -> [String] {
        func str(_ key: String) -> String { data[key] as? String ?? "" }
        func strOr(_ key: String, _ fallback: String) -> String {
            let v = data[key] as? String ?? ""; return v.isEmpty ? fallback : v
        }

        switch type {

        // ── FOLLOW ────────────────────────────────────────────────────────
        // NOTE: image is attached separately via downloadImage.
        // Lines here give extra context shown below the title.
        case "follow":
            var lines: [String] = []
            let name = strOr("followerDisplayName", str("followerUserName"))
            if !name.isEmpty { lines.append("\(name) is now following you") }
            let followers = str("followerTotalFollowers")
            if !followers.isEmpty { lines.append("Their followers: \(followers)") }
            let accuracy = str("followerAccuracyRate")
            if !accuracy.isEmpty { lines.append("Accuracy rate: \(accuracy)%") }
            lines.append("[ View Profile ]")
            return lines

        // ── BATTLE INVITE ─────────────────────────────────────────────────
        case "battle_invite":
            let hoursLeft: String = {
                guard let endTimeStr = data["endTime"] as? String,
                      let endTime = ISO8601DateFormatter().date(from: endTimeStr)
                else { return "?" }
                let hours = max(0, Int(endTime.timeIntervalSinceNow / 3600))
                return "\(hours)h"
            }()
            return [
                "Topic:",
                "\"\(str("question"))\"",
                "Forecast by \(str("inviterUserName")):  \(str("challengerSide"))",
                "Argument: \(str("challengerArgument"))",
                "Ends in: \(hoursLeft)  |  Participants: \(strOr("participantCount", "?"))",
            ]

        // ── BATTLE STARTED ────────────────────────────────────────────────
        case "battle_started":
            let timeLeft: String = {
                guard let endTimeStr = data["endTime"] as? String,
                      let endTime = ISO8601DateFormatter().date(from: endTimeStr)
                else { return "?" }
                let mins = Int(endTime.timeIntervalSinceNow / 60)
                if mins <= 0 { return "ended" }
                if mins < 60 { return "\(mins)m" }
                return "\(mins / 60)h"
            }()
            return [
                "Topic: \"\(str("question"))\"",
                "🟢 \(strOr("sideALabel","Side A"))  👥 \(strOr("sideACount","0"))",
                "🔴 \(strOr("sideBLabel","Side B"))  👥 \(strOr("sideBCount","0"))",
                "⏱ Ends in: \(timeLeft)",
                "[ View Discussion ]",
            ]

        // ── BATTLE VICTORY ────────────────────────────────────────────────
        case "battle_victory":
            var lines = [
                "🏆 You chose the winning side!",
                "\"\(str("resultText"))\"",
            ]
            if let gain = data["credibilityGain"] as? String, !gain.isEmpty {
                lines.append("⬆️ Credibility: +\(gain) pts")
            }
            if let rate = data["accuracyRate"] as? String, !rate.isEmpty {
                lines.append("🎯 Accuracy Rate: \(rate)%")
            }
            if let badge = data["badgeText"] as? String, !badge.isEmpty {
                lines.append("🏅 \(badge)")
            }
            lines.append("[ View Achievements ]")
            return lines

        // ── BATTLE COMPLETED ──────────────────────────────────────────────
        case "battle_completed":
            let sideALabel  = strOr("sideALabel", "Side A")
            let sideBLabel  = strOr("sideBLabel", "Side B")
            let winningSide = str("winningSide")
            let sideAPrefix = winningSide == sideALabel ? "🏆" : "  "
            let sideBPrefix = winningSide == sideBLabel ? "🏆" : "  "
            var lines = [
                "Topic: \"\(str("question"))\"",
                "\(sideAPrefix) \(sideALabel)  👥 \(strOr("sideACount","0"))",
                "\(sideBPrefix) \(sideBLabel)  👥 \(strOr("sideBCount","0"))",
            ]
            if let acc = data["accuracyText"] as? String, !acc.isEmpty {
                lines.append("🎯 \(acc)")
            }
            lines.append("[ View Results ]")
            return lines

        // ── BATTLE CLOSING SOON ───────────────────────────────────────────
        case "battle_closing_soon":
            var lines = [
                "Time Remaining:  \(strOr("timeRemaining","?"))",
                "\(strOr("sideALabel","Agree")):  \(strOr("sideACount","0"))",
                "\(strOr("sideBLabel","Challenge")):  \(strOr("sideBCount","0"))",
            ]
            if let acc = data["accuracyText"] as? String, !acc.isEmpty {
                lines.append(acc)
            } else {
                lines.append("Accuracy impact pending.")
            }
            lines.append("[ View Battle ]")
            return lines

        // ── BATTLE FORECAST MISSED ────────────────────────────────────────
        case "battle_forecast_missed":
            var lines = [str("resultText").isEmpty
                ? "Your side did not win this Battle."
                : str("resultText")]
            if let pen = data["credibilityPenalty"] as? String, !pen.isEmpty {
                lines.append("Credibility Score:  -\(pen)")
            }
            if let rate = data["accuracyRate"] as? String, !rate.isEmpty {
                lines.append("Accuracy Rate Updated:  \(rate)%")
            }
            if let enc = data["encouragementText"] as? String, !enc.isEmpty {
                lines.append(enc)
            } else {
                lines.append("Keep forecasting to improve your rank.")
            }
            lines.append("[ Start a New Battle ]")
            return lines

        // ── BATTLE CLOSED / RESULT (generic) ─────────────────────────────
        case "battle_closed", "battle_result":
            // These only have title/body from FCM — let APNs display as-is
            return []

        // ── DROP TRENDING ─────────────────────────────────────────────────
        case "drop_trending":
            return [
                "Your Drop: \"\(str("dropTitle"))\"",
                "👍 Reactions:  \(strOr("reactionCount","0"))",
                "💬 Comments:  \(strOr("commentCount","0"))",
                "👁 Views:  \(strOr("views","0"))",
                "[ View Drop ]",
            ]

        // ── POST COMMENT ──────────────────────────────────────────────────
        case "post_comment":
            var lines = ["\(strOr("commenterUserName","Someone")) commented:"]
            if let preview = data["commentPreview"] as? String, !preview.isEmpty {
                lines.append("\"\(preview)\"")
            }
            if let title = data["postTitle"] as? String, !title.isEmpty {
                lines.append("Post: \"\(title)\"")
            }
            lines.append("[ Reply ]     [ View Post ]")
            return lines

        // ── MENTION ───────────────────────────────────────────────────────
        case "mention":
            var lines = [
                "\(strOr("mentionerUserName","Someone")) mentioned you in a \(strOr("contextType","post"))."
            ]
            if let title = data["postTitle"] as? String, !title.isEmpty {
                lines.append("Post: \"\(title)\"")
            }
            lines.append("[ View Context ]")
            return lines

        // ── STORY VIEW INSIGHTS ───────────────────────────────────────────
        case "story_view_insights":
            return [
                "Views (last 24h):  \(strOr("viewsLast24h","0"))",
                "Reactions:  \(strOr("reactions","0"))",
                "Profile Visits:  \(strOr("profileVisits","0"))",
                "[ View Story Analytics ]",
            ]

        // ── LOW POST CREDITS ──────────────────────────────────────────────
        case "post_credit_low":
            return [
                "Credits Remaining:  \(strOr("creditsRemaining","1")) / \(strOr("totalCredits","5"))",
                "Upgrade to Valens Pro for $\(strOr("upgradePriceUsd","1.99"))/month",
                "Unlimited posts + premium analytics",
                "[ Upgrade Now ]",
            ]

        // ── BADGE / ACHIEVEMENT UNLOCKED ──────────────────────────────────
        case "badge_achievement_unlocked":
            var lines = [strOr("achievementTitle", "Achievement Unlocked")]
            let prev = str("previousTier"), next = str("newTier")
            if !prev.isEmpty && !next.isEmpty { lines.append("\(prev)  →  \(next)") }
            if let m = data["milestone"]    as? String, !m.isEmpty { lines.append("Milestone:  \(m)") }
            if let r = data["accuracyRate"] as? String, !r.isEmpty { lines.append("Accuracy Rate: \(r)%") }
            if let b = data["battlesWon"]   as? String, !b.isEmpty { lines.append("Battles Won:  \(b)") }
            lines.append("[ View Profile ]")
            return lines

        // ── MISSION POST LAUNCHED ─────────────────────────────────────────
        case "mission_post_launched":
            var lines = ["\(strOr("creatorUserName","Someone")) just launched a Mission"]
            if let t = data["missionTitle"] as? String, !t.isEmpty { lines.append("\"\(t)\"") }
            if let g = data["goal"]         as? String, !g.isEmpty { lines.append("Goal:  $\(g)") }
            lines.append("Backers so far:  \(strOr("backersCount","0"))  —  Be the first!")
            lines.append("[ Back This Mission ]     [ View Full Post ]")
            return lines

        // ── MISSION GOAL MILESTONE ────────────────────────────────────────
        case "mission_goal_milestone":
            var lines: [String] = []
            if let t = data["missionTitle"] as? String, !t.isEmpty { lines.append("\"\(t)\"") }
            let raised = data["raised"] as? String ?? ""
            let goal   = data["goal"]   as? String ?? ""
            if !raised.isEmpty && !goal.isEmpty { lines.append("Raised:  $\(raised) of $\(goal)") }
            lines.append("Backers:  \(strOr("backersCount","0"))")
            if let tl = data["timeLeft"] as? String, !tl.isEmpty { lines.append("Time Left: \(tl)") }
            lines.append("[ Back This Mission ]     [ Share ]")
            return lines

        // ── MISSION NEW BACKER ────────────────────────────────────────────
        case "mission_new_backer":
            var lines = ["\(strOr("backerUserName","Someone")) backed your Mission!"]
            if let c = data["contribution"] as? String, !c.isEmpty { lines.append("Contribution:  $\(c)") }
            let raised = data["totalRaised"] as? String ?? ""
            let goal   = data["goal"]        as? String ?? ""
            if !raised.isEmpty && !goal.isEmpty { lines.append("Total Raised:  $\(raised) of $\(goal)") }
            lines.append("Total Backers:  \(strOr("backersCount","0"))")
            if let tl = data["timeLeft"] as? String, !tl.isEmpty { lines.append("Time Left:  \(tl)") }
            lines.append("[ View Your Mission ]")
            return lines

        // ── MISSION ENDING SOON ───────────────────────────────────────────
        case "mission_ending_soon":
            var lines: [String] = ["Mission ends in \(strOr("timeLeft","24 hours"))"]
            if let t = data["missionTitle"] as? String, !t.isEmpty { lines.append("\"\(t)\"") }
            let raised = data["raised"] as? String ?? ""
            let goal   = data["goal"]   as? String ?? ""
            if !raised.isEmpty && !goal.isEmpty { lines.append("Raised:  $\(raised) of $\(goal)") }
            lines.append("[ Back This Mission Now ]     [ Share ]")
            return lines

        // ── MISSION CONTRIBUTION CONFIRMED ────────────────────────────────
        case "mission_contribution_confirmed":
            var lines = ["Your backing was successful!"]
            if let t = data["missionTitle"] as? String, !t.isEmpty { lines.append("Mission: \"\(t)\"") }
            lines.append("Creator:  \(strOr("creatorUserName","Someone"))")
            if let a = data["amountPaid"] as? String, !a.isEmpty { lines.append("Amount Paid:  $\(a)") }
            lines.append("Payment via:  \(strOr("paymentVia","Stripe"))")
            lines.append("[ View Mission Progress ]")
            return lines

        // ── PRIVATE CIRCLE EXCLUSIVE POST ─────────────────────────────────
        case "private_circle_exclusive_post":
            var lines = ["Only visible to Circle members"]
            lines.append("\(strOr("creatorUserName","Someone")) posted:")
            if let t = data["exclusivePostTitle"] as? String, !t.isEmpty { lines.append("\"\(t)\"") }
            if let c = data["circleName"] as? String, !c.isEmpty { lines.append("Posted to:  \(c)") }
            lines.append("[ View Exclusive Post ]")
            return lines

        // ── PRIVATE CIRCLE GROWING ────────────────────────────────────────
        case "private_circle_growing":
            var lines = ["\(strOr("joinedUserName","Someone")) joined your Private Circle!"]
            if let c = data["circleName"] as? String, !c.isEmpty { lines.append("Circle: \"\(c)\"") }
            lines.append("Total Members:  \(strOr("totalMembers","0"))")
            lines.append("Active Posts:  \(strOr("activePosts","0"))")
            lines.append("[ Manage Circle Members ]")
            return lines

        // ── PRIVATE CIRCLE ACCESS REMOVED ─────────────────────────────────
        case "private_circle_access_removed":
            return [
                "You have been removed from:",
                "\(strOr("ownerUserName","Someone"))'s Private Circle",
                "Exclusive posts from this Circle are no longer visible.",
                "[ View Profile ]",
            ]

        // ── WELCOME / ONBOARDING ──────────────────────────────────────────
        case "welcome_onboarding":
            return [
                "Your profile is live and ready.",
                "Free Post Credits:  5",
                "Dralens Tier:  White",
                "Battles Available:  Unlimited",
                "[ Set Up Your Profile ]",
            ]

        // ── FALLBACK ──────────────────────────────────────────────────────
        default:
            // expandedBody handled above in didReceive — nothing needed here
            return []
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // MARK: Image download + attachment
    // ─────────────────────────────────────────────────────────────────────

    private func downloadImage(
        from url: URL,
        content: UNMutableNotificationContent,
        completion: @escaping (UNMutableNotificationContent) -> Void
    ) {
        let task = URLSession.shared.downloadTask(with: url) { tempUrl, response, error in
            guard let tempUrl else {
                completion(content)
                return
            }

            let ext: String = {
                if let mime = (response as? HTTPURLResponse)?
                    .value(forHTTPHeaderField: "Content-Type") {
                    if mime.contains("jpeg") || mime.contains("jpg") { return "jpg" }
                    if mime.contains("png")  { return "png" }
                    if mime.contains("gif")  { return "gif" }
                }
                return url.pathExtension.isEmpty ? "jpg" : url.pathExtension
            }()

            let destUrl = tempUrl.deletingPathExtension().appendingPathExtension(ext)
            try? FileManager.default.moveItem(at: tempUrl, to: destUrl)

            if let attachment = try? UNNotificationAttachment(
                identifier: "image",
                url: destUrl,
                options: nil
            ) {
                content.attachments = [attachment]
            }
            completion(content)
        }
        task.resume()
    }
}