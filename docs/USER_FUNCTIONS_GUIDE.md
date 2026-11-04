# ResQAI: complete user functions and workflows

Reviewed: 3 November 2026. Source baseline: `45bbad5`.

This guide explains the current project from the perspective of a person using the mobile app or administrator website: where to go, what to enter, what happens next, and what the result means. It describes the checked-out source; a hosted service or installed APK must contain the same updates to behave this way.

**ResQAI coordinates emergency help and physical relief goods. Donations are goods only; the project does not process payments or money transfers.**

Some screens and controls have implementation gaps. These are identified beside the affected workflow and collected in [Current limitations](#17-current-limitations-and-features-without-a-complete-screen-flow). A visible button or an existing API is not counted as a complete user journey by itself.

## Contents

1. [Who uses ResQAI](#1-who-uses-resqai)
2. [Create an account, sign in, or continue as a guest](#2-create-an-account-sign-in-or-continue-as-a-guest)
3. [Home, navigation, language, appearance, and profile](#3-home-navigation-language-appearance-and-profile)
4. [Request emergency help or essential goods](#4-request-emergency-help-or-essential-goods)
5. [Track requests, add information, and work offline](#5-track-requests-add-information-and-work-offline)
6. [Offer relief goods as a donor](#6-offer-relief-goods-as-a-donor)
7. [Confirm goods receipt or report a problem](#7-confirm-goods-receipt-or-report-a-problem)
8. [Volunteer and confirm completed help](#8-volunteer-and-confirm-completed-help)
9. [Read alerts and respond to community requests](#9-read-alerts-and-respond-to-community-requests)
10. [Use the AI first-aid assistant and voice input](#10-use-the-ai-first-aid-assistant-and-voice-input)
11. [Find hospitals and open directions](#11-find-hospitals-and-open-directions)
12. [Check an AI disaster risk estimate](#12-check-an-ai-disaster-risk-estimate)
13. [Take the safety quiz](#13-take-the-safety-quiz)
14. [Use the administrator workspace](#14-use-the-administrator-workspace)
15. [Understand statuses and quantity counters](#15-understand-statuses-and-quantity-counters)
16. [Follow complete example journeys](#16-follow-complete-example-journeys)
17. [Current limitations and features without a complete screen flow](#17-current-limitations-and-features-without-a-complete-screen-flow)
18. [Source references](#18-source-references)

## 1. Who uses ResQAI

| User perspective | What this person does | Access needed |
| --- | --- | --- |
| Person needing urgent help | Sends a help/rescue report and can open emergency dialer links | Anonymous urgent help is available without documents, registration, OTP, or GPS |
| NIC guest | Uses a temporary session after NIC-format, photo, and mobile OTP submission | Guest session; identity initially awaits human review |
| Registered citizen / recipient | Requests goods, tracks owned requests, receives goods, and confirms assistance | Active account with completed mobile OTP verification for protected goods/volunteer actions |
| Donor | Offers goods against reviewed needs and follows their progress | Verified registered account to pledge |
| Volunteer | Accepts eligible community work and submits a completion note | Verified registered account; Volunteer Hub has a navigation limitation described below |
| Administrator / coordinator | Reviews requests, manages goods and missions, reviews identities, issues alerts, coordinates, and exports reports | Active administrator account on the web dashboard |

Donor, recipient, and volunteer describe activities a registered person performs; they are not three separate registration processes. A person cannot donate to their own request or confirm their own volunteer work.

Agency and district are administrator profile information. The current dashboard does not provide separate agency roles, agency-private rooms, or automatic district-only access.

### Four different meanings of verification

| Check | What it establishes in the app | What remains to be checked |
| --- | --- | --- |
| SMS OTP | Access to the mobile number when the code is entered | Identity ownership and whether an emergency claim is true |
| Guest NIC review | An administrator reviewed the submitted NIC information/photo | The need described in each incident |
| Request review | A coordinator recorded findings about a particular need | Whether goods or volunteer work were actually received |
| Receipt / completion confirmation | The recipient confirmed a delivery or help, or a documented administrator exception was recorded | Any later disagreement still requires investigation |

## 2. Create an account, sign in, or continue as a guest

### 2.1 Register and verify a mobile number

1. Open **Create Account** from Sign In.
2. Select English, Sinhala, or Tamil.
3. Enter **Full Name**, **Email Address**, **Phone Number**, **Password**, and **Confirm Password**.
4. Select **Create Account**. Invalid input, an existing email, connection problems, or a failed SMS-send attempt produces an error.
5. On **Verify Code**, check the masked mobile number displayed on screen.
6. Read the SMS sent through SMSlenz and enter its six-digit code.
7. Select **Verify Code**. Successful verification signs you in and opens Home.

The registration code expires after five minutes. **Resend SMS Code** requests a replacement code and clears the old input. Resending is limited to three requests in a 15-minute window; repeated incorrect verification attempts are also limited. An initial SMS failure does not leave a successfully registered, partly created account.

The email identifies the account for login. Citizen registration OTP is sent to the mobile number.

### 2.2 Sign in and sign out

Enter email and password, optionally use the password-eye button, then select **Sign In**. Invalid credentials, disabled accounts, connection errors, and temporary lockouts are shown. Five failed login attempts trigger a 15-minute lock.

A correct password on an account with unfinished verification opens Verify Code. Use an existing valid SMS code or select **Resend SMS Code**; the login redirect itself does not send a new SMS.

An existing locally unexpired session can reopen Home on launch, but protected requests still validate the session with the server. Session lifetimes are configurable; temporary guests should expect to sign in again sooner than registered users.

Select **Sign Out** in the header menu or Profile to clear the current login and disconnect live updates. This does not delete the account, theme/language preferences, or saved request records on the device.

### 2.3 Recover a citizen password

1. Select **Forgot Password?**.
2. Enter the registered email and select **Submit**.
3. Obtain the recovery code from the registered mobile number by SMS.
4. On the reset screen, enter the six-digit code and a new password.
5. Select **Reset Password**, then sign in with the new password.

The reset screen has no separate resend control; return to Forgot Password to request another code. The initial generic success response protects account privacy and does not prove that the account exists or that the SMS reached the handset.

Administrator recovery currently uses email instead; see [administrator access](#141-sign-in-navigation-and-session-settings).

### 2.4 Enter as an NIC guest

1. Select **Enter as Guest**.
2. Enter an old-format NIC, nine digits followed by V/X, or a 12-digit NIC. Select **Verify** if needed.
3. Read **NIC format checked**. This is a format check, followed by human identity review.
4. Attach the compulsory NIC photo using **Take Photo** or **Choose from Gallery**. Preview, retake, replace, or remove it. JPEG, PNG, and WebP images under 3 MB are accepted.
5. Enter a mobile number and select **Send OTP**.
6. Enter the six SMS digits. The guest resend button has a 45-second countdown, and the server limits repeated sends.
7. Select **Verify & Continue as Guest**. GPS is attempted, but unavailable GPS does not prevent continuation.
8. Home opens with a temporary phone-verified guest session. NIC identity review starts as pending.

Camera/library permissions are requested when needed. On web, the camera modal offers **Snap Photo** and a device-file fallback. Failure to access a camera does not make an image automatically valid.

Guest approval does not approve their emergency reports. The mobile app currently has no separate guest-review status panel or guest-to-registered-account conversion screen. A rejected guest session is blocked; sign out to use the document-free urgent-help route or contact a coordinator.

### 2.5 Continue without documents for urgent help

Use the urgent-help link from Sign In or **Need urgent help? Continue without documents** on the guest screen. This opens the request form directly. Choose **Help / rescue**. A person can send that report without an account, NIC, photo, OTP, or GPS. Essential-goods requests require a verified registered account.

## 3. Home, navigation, language, appearance, and profile

### 3.1 Home and emergency contact links

| Home function | User action | Result |
| --- | --- | --- |
| Request Help | Tap the quick action | Opens the help/rescue and essential-goods form |
| Hospitals | Tap the quick action or map preview | Opens the hospital locator |
| AI Assistant | Tap the quick action | Opens the first-aid chat |
| Flood Prediction | Tap the quick action | Opens automatic weather-based risk assessment |
| Weather widget | Allow location; retry if a weather fetch fails | Shows city, conditions, temperature, feels-like temperature, humidity, and wind |
| Map preview | View the device/reference location; open the map | Opens the locator or external map as provided by the platform |
| Emergency number cards | Tap 1990, 110, or 119 | Opens the device dialer; the user must complete the call |

Submitting a ResQAI report and making an emergency call are separate actions. Home has no hold-to-send SOS countdown or automatic ambulance-dispatch button.

Home weather and the prediction page serve different purposes. Home is a weather summary; prediction explicitly uses the latest complete weather day. Home may use Colombo as a fallback. A location-permission denial can currently leave its weather widget showing Loading; this is listed in the limitations section.

### 3.2 Navigation

The bottom bar provides **Home**, **Alerts**, **Activities**, and **Profile**. Profile opens a sheet. The header logo returns Home; the back arrow returns to the previous screen or Home. The header's three-dot menu contains **Language / Appearance** and **Sign Out**.

Profile also provides **Safety Quiz** and **Donate**, which opens physical relief goods. **Activities → Relief goods** is another route to donations and deliveries. There is currently no normal Home/Profile/menu link to Volunteer Hub.

### 3.3 Language and appearance

Use the header **Language** selector or **Language / Appearance** to choose English, Sinhala, or Tamil. The preference is saved on the device and can sync to a registered account. Some remaining labels/messages use English fallback.

Appearance offers **Light**, **Dark**, and **System**. Changes apply immediately and persist on the device; System follows the device appearance setting. Select **Done** to close.

### 3.4 Profile picture

Tap the avatar for **View Photo**, **Change Photo**, or **Cancel**. View Photo enlarges the picture. Change Photo offers eight responder avatar presets, **Upload Photo from Device**, and **Reset to Default Initials** where applicable.

Preset/reset changes apply locally and attempt an account update for registered users. Custom device-file upload is currently implemented only on web; its displayed native upload control has no action. The current Profile sheet does not expose name, email, or phone editing. Avatar background-save failures are not clearly reported, so cross-device persistence should not be assumed.

## 4. Request emergency help or essential goods

### 4.1 Fill the request form

Open **Request Help** from Home, an urgent-help entry link, or **Activities → New request**. The **Immediate danger?** card offers a 1990 dialer link and **First-aid guidance**.

| Field or control | What to enter or choose |
| --- | --- |
| Request kind | **Help / rescue** or **Essential goods** |
| Describe the situation | At least five characters; include what happened and the help needed; initial form maximum 4,000 characters |
| Are any people affected? | Choose Yes or No; a choice is required |
| How many people are affected? | Shown for Yes; enter a whole number from 1 to 100,000. No records zero |
| Address, village or landmark | Optional location description, up to 255 characters |
| Use device location | Optional permission-based GPS capture; coordinates are shown when obtained |
| Supporting details | Optional text up to 2,000 characters, such as information a coordinator can check |

**Update device location** refreshes previously captured coordinates. GPS failure or permission denial displays a message; help reports can still be submitted using a landmark or unknown location. The form does not substitute a fabricated GPS position.

Supporting details are a written note. This request form does not upload emergency photos, identity documents, videos, or signatures.

### 4.2 Request essential goods

Sign in with an active, mobile-verified registered account, choose **Essential goods**, and add:

- Item name, such as drinking water or blankets.
- Positive whole quantity, from 1 to 100,000 in this form.
- Unit, such as packs, bottles, or pieces.

Use **Add another item** for up to 20 rows. **Remove item** appears when more than one row exists. Avoid repeating the same item/unit pair; the coordinator's approval checks require a valid, nonduplicated list.

These are goods you need to receive. Offering goods to someone else happens in **Relief goods**, described later.

### 4.3 Send and interpret the result

Select **Send request**. The app saves the submission locally first, then attempts to send it.

| Result | Meaning | Next action |
| --- | --- | --- |
| Sent / Received by ResQAI | The server received an unverified report | Open **Track my requests** and follow review progress |
| Queued · not sent / Saved on this device | The report has not reached the server | Keep this device/session; reconnect or retry in Activities |
| Action needed | The server rejected the saved submission and an error is shown | Read the error; correct what the screen permits and retry as appropriate |

The confirmation shows a shortened submission reference. **New request** appears after a successful send and clears description/supporting details; review the other retained fields before submitting another case.

Server receipt does not mean a coordinator confirmed the need or dispatched assistance. New reports begin pending and unverified. Other users immediately see a generic **Unverified** listing; private descriptions, exact locations and identity evidence are withheld. Users do not choose urgency: automated triage uses the description and affected-person response to estimate priority and can add an English summary; it does not establish that a claim is genuine. Similar recent reports, unconfirmed locations, anonymous reports, and pending guest identity can produce review flags.

After the request is received, a signed-in phone-verified user can open **Add private identity photos (optional)**, consent to private review/seven-day retention, start a capture challenge, attach an NIC image and take a camera selfie with the fresh six-digit code written on paper beside their face. The same control is available in expanded Activities details. Photos stay outside the offline submission queue. Owners can delete uploads; only authorized administrators can open image bytes. Uploads remain pending human review and do not automatically verify identity or the incident. Anonymous urgent help remains available without these photos. See [private evidence configuration and limits](REQUEST_DELIVERY.md#private-nic-and-camera-selfie-evidence).

## 5. Track requests, add information, and work offline

### 5.1 My activity

Open **Activities**. Use **New request**, **Relief goods**, and pull-to-refresh as needed.

- **Saved on this device** lists queued/action-needed submissions with description, location, time, and error details.
- **Submitted requests** shows owned submissions, verification and handling badges, reviewer notes, and requested goods.
- **View request history** expands the full request reference and dated review/status notes; select it again to collapse.

Registered users and current NIC guests can retrieve their protected request history. Anonymous users rely on local successful-submission receipts. If the server cannot be reached, saved receipt copies may remain visible but may be stale.

### 5.2 Respond to a request for information

When verification is **Not yet verified** or **More information needed**, and handling is still pending:

1. Read the coordinator's note.
2. Select **Update request details**.
3. Edit the description and supporting details.
4. Select **Resubmit for review**.
5. The request returns to unverified review; its history remains available.

This modal does not currently edit people count, location, or goods rows. Once handling starts or the request becomes ineligible for editing, contact the coordinator. There is no citizen cancel/delete-request control.

### 5.3 Offline saving and retry

The offline banner states that requests will sync when connected. **Send request** is the action that persists a submission; merely typing into an unsent form does not create an automatic draft.

Queued requests retry when connectivity returns or the app becomes active. **Retry saved requests** in Activities also retries queued and action-needed entries. Network errors, server errors, and rate limiting can keep a request queued; other rejection responses require user attention.

Retries retain a submission identifier so a successful request is not accidentally created twice. Queues and receipts are separated by the account/guest-session that created them. Signing into another account cannot submit someone else's queue. Anonymous queues remain in their anonymous device context. Expired guest sessions have no queue-recovery/migration screen.

Keep the same app/browser storage until queued requests are sent. Clearing storage removes local queues and receipts. The device receipt cache keeps the most recent 100 successful submissions. Activities has no delete/edit-queued-entry control. This offline capability applies to request submission and saved records; online AI, weather, goods operations, identity OTP, and live updates still need connectivity.

## 6. Offer relief goods as a donor

### 6.1 Browse needs

Open **Profile → Donate** or **Activities → Relief goods**. The page has **Items needed**, **My contributions**, and **My deliveries**.

**Items needed** lists active missions linked to verified, open goods requests with a registered recipient and approved item needs. Cards show the mission, district/reference area, reviewed badge, item/unit, quantity still open for pledges, pledged total, and confirmed delivery progress. Public mission descriptions use generic wording to avoid exposing the original private report and contacts.

### 6.2 Make an offer

1. Sign in with a verified registered account.
2. Select **Offer these items** beside the need.
3. Enter **Quantity** in its displayed unit. It must be positive, have at most two decimal places, and fit the current unpledged quantity. The API maximum is 1,000,000.
4. Choose **New / unopened** or **Good usable condition**.
5. Enter **Collection or availability details**, at least three meaningful characters and up to 1,000 characters.
6. Select **Confirm my offer**.
7. The app switches to **My contributions**. The offer is pledged; the mission team still has to receive the physical goods.

The server rejects offers to your own request, closed/unverified requests, inactive missions, and quantities another donor has already committed. Refresh when quantities change. A retried identical offer uses its original submission identifier to avoid duplication.

### 6.3 Follow the goods

**My contributions** displays item, quantity/unit, mission, current pledge status, and received/dispatched/confirmed-delivered quantities. The condition and availability details are saved, though the current contribution card does not display them again; coordinators can see them.

The sequence is **Pledged → Received → Dispatched → Partly delivered / Delivered**. Each stage describes a different event. A pledge does not add received stock, and dispatch does not establish receipt by the recipient.

There is no money amount, card/bank form, payment gateway, financial checkout, recurring payment, or monetary receipt in this journey. Cancellation before physical receipt exists in the API but has no current mobile button.

## 7. Confirm goods receipt or report a problem

### 7.1 Confirm your delivery

1. Sign in as the registered recipient who owns the originating request.
2. Open **Relief goods → My deliveries**.
3. Read the item, unit, delivery quantity, mission, status, and dispatch note.
4. For a dispatched delivery, select **I received these items**.
5. Confirm only when the full displayed quantity was received; select **Confirm** in the modal.

This marks that delivery delivered, updates confirmed quantities, and records the recipient action. Retrying a confirmation does not add the quantity again. Another user cannot confirm it, and a donor cannot confirm receipt of their own donated goods.

**The confirmation mechanism is the signed-in recipient account. There is no delivery OTP, SMS handover code, QR scan, photograph upload, or digital signature in the current goods flow.** Signup/password OTP through SMSlenz is separate.

### 7.2 Report missing, damaged, or incorrect goods

For a dispatched delivery, select **Report a delivery problem**, describe the problem using at least five meaningful characters, and submit. The delivery becomes **Under dispute**; it does not increase confirmed delivered quantity.

The recipient cannot enter a smaller received quantity on the confirmation screen. Use the problem report for a partial or incorrect delivery. A delivery already confirmed delivered has no correction/dispute button in this page.

### 7.3 Independent coordinator review

A coordinator other than the person who dispatched that delivery reviews the dispute, speaks to the recipient, and records findings. The review can:

- Confirm delivery after investigation, adding confirmed delivered quantity.
- Record goods returned to available stock, allowing those goods to be dispatched again.

The screen retains the dispute reason and review findings. Evidence here consists of recorded notes, actor, and time; it is not an uploaded proof attachment. The system records the investigation outcome but does not automatically prove what physically occurred.

## 8. Volunteer and confirm completed help

**Access limitation:** Volunteer Hub exists at the mobile `/volunteer` screen, but the current Home, Profile, and three-dot menus do not link to it. The normal visible acceptance action is **Acknowledge Alert** on a reviewed community request. The following Hub actions describe the implemented screen when it is opened directly; they should not be presented as a fully connected menu journey.

### 8.1 Accept work

Volunteer Hub has **Available**, **My assignments**, and **Confirm help**.

In **Available**, browse active help missions linked to reviewed, open requests, read the district/generic description, and select **Join**. Donation missions are hidden in this tab. Joining creates an accepted assignment; an existing eligible assignment is reused. You cannot join your own request.

A help mission is first created/reused when a verified registered helper acknowledges an eligible community help request in Alerts. Subsequent volunteers can join its active mission through the Hub.

### 8.2 Report work completed

1. Open **My assignments**.
2. For accepted/active work, select **Report work completed**.
3. Describe **Work completed** using at least five meaningful characters, up to 1,500.
4. Select **Submit for confirmation**.
5. The screen shows **Completion reported · awaiting confirmation**.

Submitting a note does not complete the assignment. Repeating this action retains the first saved completion note; it is not a revision tool. There is no current Hub skills form, scheduling, hours entry, check-in, or withdrawal control.

### 8.3 Recipient confirmation or administrator exception

The owner of the originating request opens **Confirm help**, reads the volunteer's name and completion note, and selects **I received this help**. The assignment becomes completed and the recipient confirmation is recorded. A volunteer cannot confirm their own work. There is no recipient rejection/partial-completion button here.

When the recipient cannot confirm, an administrator can investigate a submitted completion request using **Review completion exception** in the mission detail. A written reason records a distinct administrator-reviewed completion; it is not labelled as personal recipient confirmation.

## 9. Read alerts and respond to community requests

### 9.1 Browse and filter

Open **Alerts** and pull down to refresh. The feed contains administrator broadcasts and generic summaries of open community help/goods requests. New requests appear immediately with **Unverified** or **More information needed** badges; reviewed requests display **Verified**. Rejected or closed cases disappear. Community acceptance and goods fulfillment remain unavailable until verification.

Use **All**, **Present**, and **Past**, text search, and hazard-type filters when available. Present means active and not past its expiry. Cards show the hazard, relative time, district if supplied, status, expiry if supplied, and work-plan text. Search can match type, district, and work plan. Select × to clear search.

The **117** control opens the dialer. The saved feed refreshes after approval and broadcast events, reconnection, opening the screen, app resume, and every 15 seconds while the screen is active. A new saved alert can show a temporary banner. Pull-to-refresh remains available if live updates are unavailable.

### 9.2 What “Acknowledge Alert” currently does

For a reviewed **community request**, an active, verified registered citizen can select **Acknowledge Alert** to accept helping. The system creates/reuses a mission and volunteer assignment, and may move pending handling into progress. The button becomes **Acknowledged**.

This is a participation action. Do not tap it merely to mark information as read. Your own request, closed/unverified cases, inactive missions, and ineligible goods missions are rejected. Guests and anonymous users cannot accept assignments.

**Current defect:** the same button appears on ordinary administrator broadcasts, but that API action only handles community requests. Broadcast acknowledgment can therefore fail with **Community request not found**. Broadcast read receipts are not implemented.

### 9.3 Detail screens and notification limits

Alert-list cards currently have no tap-to-open detail navigation. A broadcast detail screen exists for notification/deep-link entry, but it has work-plan/area display mismatches and the broadcast acknowledgment issue above. Read the feed's visible work-plan text rather than assuming detail has complete instructions.

Native notification listeners exist, but push registration is not called and no push sender is configured in the inspected flow. Do not assume that an installed APK receives push messages while closed. Native alert caching is best effort; cached status/expiry information may be incomplete. Web does not have that SQLite alert cache.

## 10. Use the AI first-aid assistant and voice input

1. Open **AI Assistant** from Home or **First-aid guidance** from Request Help.
2. Type a question and press Send, or select one of the suggested questions for bleeding, bandaging, burns, CPR, or choking.
3. Read the assistant reply and its timestamp. The service attempts to detect the message language and reply in that language.
4. If the service flags a critical emergency or cannot provide a response, a call banner can appear. Tapping it opens the 1990 dialer.

For voice input, select the available English/Sinhala/Tamil recognition language, permit microphone access, tap the microphone, speak, then stop. Recognition fills the text input; review it before sending. Browser recognition needs a supported browser, and native recognition needs the native module and device support. A disabled/unavailable microphone does not prevent typed questions.

The assistant provides general emergency information. It does not diagnose, book an ambulance, create a help request, or contact a coordinator from the chat. Critical keyword handling can return a call instruction without waiting for an external AI response. If AI is unavailable, the screen shows fallback information and a call option.

The displayed conversation is held in the current screen session; there is no saved chat-history screen. The request sends the current message, so do not assume earlier chat turns are supplied as conversational memory. Voice input is transcription, not a spoken-answer feature.

### How AI helps elsewhere

Incident submission can use automated report parsing to produce incident type, urgency assistance, and an English summary for coordinators. A bounded fallback allows the report to be saved even when AI is unavailable. The requester does not separately translate the report or press an AI-approval button.

Summary-generation APIs also exist, but the current **Operational reports** page generates a database summary; it does not call the AI narrative generator. A hospital recommendation can use AI, with a nearest-record fallback. Neither feature verifies the truth of an emergency claim.

## 11. Find hospitals and open directions

1. Open **Hospitals** or tap the Home map preview.
2. Allow **Use current location** / GPS, refresh location, or search for a city/address.
3. Choose an emergency category: Medical, Flood, Accident, Fire, or Trapped.
4. Review nearby hospital cards and any suggested hospital/reason.
5. Select **Map** to open the hospital coordinates externally, or **Call** where a number exists.

The page displays location coordinates and available accuracy information. If GPS is denied or fails, it can show a clearly labelled Colombo fallback; search for the correct area before relying on its distances. Address search uses an online map lookup and can return a no-result/error message.

The primary mobile API searches active hospital records, orders them by geographic distance, and returns up to 15. AI can suggest a suitable entry from those records; failure falls back to the nearest listed record. Distances indicate proximity, not a live travel-time promise. Medical/accident choices display an emergency-call banner.

Maps depend on platform/network support. Web can use an interactive Google map or an embedded fallback; external map links remain separate from the hospital list. This feature does not check real-time beds, confirm hospital capacity, book treatment, or reserve transport.

## 12. Check an AI disaster risk estimate

1. Open **Flood Prediction** from Home. The page title is **AI Disaster Risk Estimate**.
2. Select your district.
3. Optionally select **Use My Location** for weather coordinates. Confirm that the selected district matches your location; it supplies the model's district profile.
4. Without GPS, the system uses a labelled district reference point. GPS denial/time-out permits continuing with that reference point.
5. Select **Check Risk**. No rainfall numbers are required in the ordinary flow.
6. Read the flood assessment, compact weather/rainfall summary, rainfall screening status, any elevated-risk guidance, and emergency call actions.
7. Open **More details** for model probabilities/risk score, source/model, input window, retrieval time, cache indication, weather grid point, district profile, and map. The source is displayed as text without an external link.
8. Select **Refresh Weather & Risk** to request another current snapshot. Use Retry to return to selection when shown.

The service obtains modeled weather inputs from Open-Meteo: rainfall totals for 24/48/72 hours, soil moisture, temperature, and wind. It uses the **latest complete day in Asia/Colombo**, not live current conditions or a next-day forecast. A district reference point and weather grid do not represent every house in that district.

Missing, incomplete, or expired weather produces an unavailable message; the automatic path does not assume zero rainfall. Expired snapshots hide the risk cards until refreshed. Selecting another district clears the previous GPS choice so old coordinates are not silently reused.

**Advanced: manual demonstration** exposes a nonnegative 24-hour rainfall input and **Run Demonstration**. Other omitted inputs use reference/default values; its result is labelled demonstration. The ignored monthly-rainfall entry form and invented annual-rainfall figure have been removed.

These remain experimental model estimates. The rainfall screening indicator is generated by the project; it is not an issued NBRO warning. Model probabilities are not field-validated flood probabilities. See [Automatic risk assessment](AUTOMATIC_RISK_ASSESSMENT.md) for the source and model limits.

## 13. Take the safety quiz

1. Open **Profile → Safety Quiz**.
2. Wait for a randomized set of up to ten questions.
3. Choose one answer. The screen locks that question's selection, highlights the correct answer, and provides feedback/explanation.
4. Select Next; the last question leads to results.
5. Review the score, performance message, and incorrect answers with the correct answers.
6. Select the retry action for another randomized attempt or return Home.

If questions cannot load, the screen offers Retry/Home. Quiz scoring is an educational feature. The current submission endpoint calculates the attempt result but does not store a personal attempt history, certificate, or leaderboard.

## 14. Use the administrator workspace

### 14.1 Sign in, navigation, and session settings

Open the administrator website, enter email/password, and select **Login**. Active administrator credentials are required; there is no administrator self-registration screen. Protected actions reject a suspended or expired session.

The sidebar contains **Dashboard**, **Alerts**, **Requests**, **Missions**, **Goods & Deliveries**, **Agency Coordination**, **Users**, **NIC Verification**, and **Reports**. Smaller screens use Menu/Close. The light/dark toggle saves locally; Sign Out clears the current browser session.

Administrator **Forgot Password? → email → Send OTP → OTP + New Password → Reset Password** currently sends email through SMTP because administrator records have no mobile number in this flow. **If only SMSlenz is configured, this administrator email recovery path is unavailable.** Its generic “sent” message does not confirm mail delivery. The normal public-user recovery route uses mobile SMS.

Administrator name/agency/district update APIs exist, but no current dashboard profile screen exposes them. Sidebar “Admin / Coordinator” and “TELEMETRY ACTIVE” are fixed labels, not a live identity/connectivity report.

### 14.2 Response overview

Dashboard displays eight linked operational cards: urgent reports awaiting response, awaiting need verification, active missions, delivery disputes, resolved requests, confirmed goods deliveries, goods pledges, and active public alerts.

The waiting queue shows up to ten pending reports, highest priority then oldest, with requester, type/message, verification, handling status, and time. Open a row for details. Shortcuts open request review, goods coordination, or reports; **Refresh overview** reloads the overview. Cards/queue also refresh periodically and through live events.

This page includes the shared agency chat. It has no operational map, date/district filter, or chart. Card links open their destination pages without automatically applying the card's filter.

### 14.3 Review and verify requests

Open **Requests**. Its initial verification filter is **Unverified**. Combine request type, verification state, urgency toggle, handling status, and message/requester search. Use Refresh and Previous/Next; the page displays 20 rows per page and refreshes periodically.

Open **View Details** to inspect the original report, people affected, priority/source, incident type, location provenance/coordinates link, itemized goods, supporting note, review flags, requester contact and phone-OTP state, missions, participants, quantities, and review/status history.

To review the need:

1. Contact or investigate using the information available.
2. Choose **Request more information**, **Confirm need**, or **Reject request**.
3. Select the method actually used: **Phone callback**, **Field visit**, **Agency confirmation**, or **Document review**.
4. Enter **Findings and reason**, 10–2,000 characters.
5. Select **Save review**. The decision, coordinator, method, time, and notes are recorded.

An intervening review by another coordinator is rejected as stale; refresh and reassess. Requesting more information is available while handling is pending. The requester can see the review note in Activities; no automatic callback, SMS, or email asking for more information is sent by this action.

Confirming a goods need requires a registered recipient and a valid item/unit/quantity list. Approval creates/reactivates the goods mission and approved needs. Removing approval pauses open goods missions. Review flags and AI priority remain investigation aids, not proof of fraud or authenticity.

To update handling, choose **In progress** or **Finished — missions completed**, supply a 10–2,000-character reason, and select **Update response status**. Urgent help can start while checks continue; goods handling requires a verified need. Finished requires prior In progress and at least one associated mission, with all associated missions completed. Closed requests cannot be reopened through this control.

There is no admin request-create, original-report edit, manual urgency-change, volunteer-assignment, cancellation/deletion, or reopen control in the current request screens.

### 14.4 Coordinate goods and deliveries

1. Open **Goods & Deliveries**, select a goods mission, and inspect requester, need verification, mission status, and quantities. Links open the request or mission.
2. Use **Add item** to record another approved item, unit, required quantity, and reason. Use **Adjust need** to change the total required amount. The total cannot fall below existing pledge commitments.
3. In **Donor pledges and stock**, inspect the donor's condition and availability note.
4. Select **Receive**, enter the quantity physically received from that pledge, add an evidence/reason note, and select **Record operation**.
5. Select **Dispatch**, enter some or all available received stock, record **Handover plan and evidence note**, and save. The recipient is the registered owner of the originating request.
6. Monitor **Deliveries and disputes** for recipient confirmation or a delivery problem.
7. Review a disputed delivery using a coordinator different from its dispatcher, recording either returned stock or delivery confirmation after investigation.
8. Read **Goods history** for dated operations, quantities, reasons, and actors.

Add/Adjust/Receive/Dispatch require an active mission and verified open need. Quantities must be positive, at most 1,000,000, with at most two decimal places. The interface requires operation notes of 10–1,500 characters. Receive/Dispatch are increments, while Adjust need sets a new total.

Partial receipt and separate partial dispatches are supported. You cannot receive more than the pledge, dispatch more than received stock, or record confirmed delivery beyond dispatched quantity. Receive/dispatch retries use operation identifiers to prevent duplicated stock increments. An ordinary dispatched delivery has no coordinator “confirm receipt” shortcut; the recipient confirms it or an independent dispute review resolves it.

### 14.5 Manage missions and completion

Open **Missions** and choose All, Active, Help, Goods, or Completed. Help/Goods filters show active missions of those types. **View Details** shows the originating request, volunteers, goods, confirmation evidence, and history.

To change a mission, select the next status, enter **Reason and checks completed** using 10–2,000 characters, and select **Update mission status**.

| Current status | Permitted next statuses |
| --- | --- |
| Planning | Active, Cancelled |
| Active | Paused, Completed, Cancelled |
| Paused | Active, Cancelled |
| Completed / Cancelled | Closed; no next transition |

Goods completion requires approved needs to be fulfilled by confirmed deliveries and all received stock/dispatched or disputed deliveries to be settled. Goods cancellation also requires stock/delivery settlement. Help completion requires at least one supported completed assignment and no unresolved/unproven assignments. A volunteer's own completion note alone is insufficient.

For a reported completion without recipient confirmation, **Review completion exception** requires **Evidence and reason** of 20–1,500 characters. Select **Record reviewed completion** only after checking the callback/field/agency evidence. A fresh assignment without a completion request cannot use this shortcut.

Mission creation is workflow-driven: goods approval creates goods missions; community help acceptance creates help missions. There is no general create/edit-title/edit-description/delete-mission or assign-volunteer screen.

### 14.6 Review guest NIC submissions

Open **NIC Verification**. Review Total/Pending/Approved/Rejected counters, filter by status, search NIC/phone, and page through the session list.

Click the photo to open **NIC Photo Inspection & Verification**. Inspect the picture and NIC/phone details, enter optional **Admin Verification Notes**, and choose **Approve Identity** or **Reject Identity**. Row-level Approve/Reject controls are also available. Approval and rejection can subsequently be changed through those controls.

Approval records reviewed identity status; rejection blocks the guest session and disconnects live access. Neither action approves an emergency need. This is manual inspection, with no national identity-registry lookup, automatic ownership match, or document-authenticity guarantee. The route sends no explicit guest SMS/email about the decision.

### 14.7 Manage registered users

Open **Users**, search name/email/phone, and use pagination. Rows show contact details, user type, phone-OTP state, joined time, **View**, and **Suspend**. **View** opens the person's request and goods-contribution history and totals.

For an unverified user, **Resend OTP** sends a verification request to the registered mobile. It does not reveal the code or let the administrator mark the user phone-verified.

**Suspend** / **Suspend Account** requires confirmation, disables the account, and revokes its live connections. The current UI has no restore button. Reactivation and user-type changes exist only through the API. A public user's type label does not grant administrator access. There is no current create/delete-user, manage-admin-accounts, or edit-user-profile screen.

### 14.8 Issue and cancel public alerts

**This workflow has form/backend mismatches.** Read the constraints below before demonstrating it.

Open **Alerts → Issue New Alert**. The form offers **Disaster Type**, **Affected Zone**, **Preliminary Work Plan**, **Expires After**, a preview, **Issue Alert**, and **Save Draft**.

The backend can issue an alert with valid polygon geometry and send SMS through SMSlenz to eligible registered users whose stored location lies in that area. An untargeted backend request can broadcast more widely, but the normal form has no clear nationwide option. There is no drawing map or district-name-to-boundary conversion. Ordinary district text in Affected Zone is rejected; the current backend expects a valid geographic WKT `POLYGON` or `MULTIPOLYGON`.

On successful creation, inspect the response rather than assuming all recipients were reached. Missing SMS configuration or provider failure can leave a saved alert with zero accepted SMS messages. Counts indicate gateway acceptance; they do not establish handset delivery, reading, or native push receipt. A targeted SMS audience depends on users having eligible accounts and stored GPS; guest-session numbers are not that registered-user audience.

On the alert list, **Cancel** on an active row asks for confirmation and updates its state. It does not send a corrective cancellation SMS. Current limitations include unsupported Save Draft, no edit/schedule/delete flow, a broken Stats destination, ineffective type/pagination controls, an All Statuses control that defaults to active server results, and the “Manually Cancel” option being stored with a 24-hour expiry. The form also has no severity selector and sends severity 1. Expiry timestamps are stored, but no automatic persisted-status expiry scheduler was found.

### 14.9 Agency coordination room

Open **Agency Coordination** or use the chat embedded in Dashboard. Read sender, agency/district information, message, and time. The latest 50 messages load initially; **Load older messages** retrieves more.

Enter **Message** using 1–2,000 characters and select **Send message**. Messages persist across reconnection. Live events update the room, with periodic polling as a fallback. This is one shared room for active administrators. It has no citizen chat access, private agency channel, direct messages, attachments, edit/delete, read receipts, or SMS forwarding.

### 14.10 Generate and export operational reports

1. Open **Reports**.
2. Select **Generate current report**.
3. Read the operational narrative, source, generated time, verification/response counts, participant counts, mission/delivery totals, and average review/resolution times.
4. Inspect goods totals grouped by matching item and unit.
5. Select **Download CSV** for a spreadsheet, or **Print / Save PDF** for the browser print dialog.

The narrative is generated from recorded database totals. Different units, such as packs and kilograms, are kept separate. Missing completed-record averages display **No completed records yet**. Confirmed-delivery totals can include documented dispute resolutions.

A report remains a snapshot until regenerated. A failed regeneration can leave the previous report visible. There is no date/district filter, scheduled report, stored report-history screen, email delivery, AI narrative call, or direct server-generated PDF download in this page.

## 15. Understand statuses and quantity counters

### 15.1 Request verification and handling

| Verification code / label | User meaning |
| --- | --- |
| `unverified` / Not yet verified | Submitted, awaiting a recorded need review |
| `needs_information` / More information needed | A coordinator needs additional information |
| `verified` / Reviewed and verified / Need confirmed | A coordinator recorded that the need was confirmed |
| `rejected` / Not approved | The claim was not approved in the recorded review |

| Handling status | User meaning |
| --- | --- |
| Pending | Waiting for a response workflow |
| In progress | Response work has started |
| Finished in administrator view / Resolved in request record | Associated missions were completed and the request was closed |

The database also supports legacy states such as AI processing, dispatched, and cancelled. Their presence in a model or readable badge does not imply a current citizen control to set them. Verification and handling are separate: an urgent report can be investigated before all need checks finish.

### 15.2 Goods and delivery states

| State | Meaning |
| --- | --- |
| Pledged | A donor offered a quantity |
| Received | A coordinator recorded some physical goods received against the pledge |
| Dispatched | Some goods were sent toward the recipient |
| Partly delivered | Some, but not all, pledged quantity is confirmed delivered |
| Delivered | The complete pledge quantity is confirmed delivered |
| Under dispute | A specific dispatched delivery has a recipient-reported problem |
| Returned | Reviewed delivery quantity returned to available stock |
| Cancelled | Pledge cancelled before receipt through the available API operation |

Pledge status and delivery status describe different records. One pledge can have multiple separate deliveries. A partly received pledge can still show Received, so read its numerical counters.

**“Still needed” for donors = required minus noncancelled pledges. “Remaining need” for coordinators = required minus confirmed delivered.** Thus a need can stop accepting offers while still awaiting physical delivery. Inventory maintains `confirmed delivered ≤ dispatched ≤ received ≤ pledged`.

### 15.3 Volunteer progress

Joining creates Accepted. A completion report means awaiting confirmation. Completed requires recipient confirmation or a recorded administrator exception. Additional model states such as Pending, Active, and Withdrawn exist, but the current Hub does not expose every transition or an hours/withdrawal editor.

## 16. Follow complete example journeys

### 16.1 Goods from request to receipt

1. A registered recipient completes mobile SMS verification.
2. In Request Help, they request **10 packs of drinking water**, describe the situation and landmark, and send.
3. Activities shows received but unverified. Other users see a generic Unverified listing while the full description and supporting evidence remain private to the owner and coordinators.
4. A coordinator calls or checks the situation, records the real method/findings, and confirms the need.
5. A goods mission with that approved item becomes available in Items needed.
6. Another verified citizen pledges 10 packs and records collection details.
7. The coordinator physically receives 10 and records Receive with a reason.
8. The coordinator dispatches 6 packs, then 4 packs in a separate delivery, each with a handover note.
9. The recipient sees two deliveries and confirms each only after receiving its full displayed quantity.
10. Confirmed delivered becomes 10. The coordinator settles all stock/deliveries, completes the mission, and finishes the request after starting its response workflow.
11. The donor sees delivery progress and the coordinator can include the recorded totals in an operational report.

If a delivery is wrong or incomplete, the recipient reports a problem instead of confirming. A different coordinator investigates and records a return or confirmed delivery outcome. The quantity is not counted delivered just because it was pledged or dispatched.

### 16.2 Urgent help without documents

1. A person opens the document-free urgent-help entry.
2. They can open the emergency dialer and separately submit a Help / rescue report with a landmark, people count, and optional GPS.
3. Without connectivity, the submission is visibly queued, not described as received.
4. After server receipt, coordinators see the unverified report and priority/review signals.
5. A coordinator can start investigating urgent help while checks continue.
6. After verification, the generic community request may appear in Alerts.
7. A verified helper uses community Acknowledge Alert, creating a mission/assignment and starting response progress if needed.
8. Completion still requires supported evidence. An anonymous requester has no registered-account recipient-confirmation journey; the administrator-reviewed completion exception is relevant when recipient confirmation is unavailable.

### 16.3 Weather check without rainfall knowledge

Select the district, optionally use GPS, select Check Risk, and read the estimate with its weather date/source. No rainfall number is required. If data is unavailable, demonstrate the unavailable state rather than substituting a guessed input. Manual numbers belong to the explicitly labelled demonstration mode.

## 17. Current limitations and features without a complete screen flow

These findings describe the reviewed source. They are included so a user or viva presenter can distinguish the available workflows from controls that still need work.

| Area | Current practical limit |
| --- | --- |
| Verification | Phone OTP, NIC inspection, human need review, and account-based receipt reduce specific risks; none provides an automatic fraud-free guarantee |
| Goods proof | No delivery SMS OTP, QR, handover photo, signature, or evidence-attachment upload; receipt uses the authenticated account and written review history |
| Volunteer navigation | Hub exists but is absent from normal Home/Profile/menu links; completion/confirmation screens therefore have a navigation gap |
| Broadcast acknowledgment | Button currently calls community-request acceptance and fails for ordinary broadcasts; it is not a working broadcast read receipt |
| Alert details | No card-to-detail tap navigation; notification/deep-link detail has work-plan and area-display mismatches |
| Alert creation/management | Geographic text-input mismatch, unsupported draft, expiry/manual-cancel mismatch, broken Stats link, partial list filters, and no scheduling/edit/delete interface |
| Push delivery | Notification listener/helper code exists, but registration is not invoked and no configured push sender completes the user journey |
| SMS reporting | Gateway acceptance is counted; handset delivery and user reading are not established |
| Administrator recovery | Uses SMTP email; SMSlenz-only configuration does not supply that email channel |
| Home weather | GPS permission denial can leave Loading with a Colombo map fallback; distinguish this from the explicit prediction-location workflow |
| Profile | Custom upload works on web only; no mobile name/email/phone editor; account avatar sync failures are not visibly reported |
| Guest experience | No review-status panel, account conversion, or expired-session queue-recovery screen; old NULL review-state rows can be counted as pending but missed by the Pending filter |
| Request editing | Details modal edits description/supporting note only; no citizen cancel/delete or saved-queue editor |
| User administration | No restore/account-create/delete/role-edit screen; some limited reactivation/type operations exist only in the API |
| Mission administration | No general mission CRUD or coordinator assignment screen; missions arise through the defined request workflows |
| AI and hospital advice | No guaranteed diagnosis, emergency dispatch, live bed availability, appointment booking, or persisted conversational memory |
| Model estimates | Latest complete-day modeled weather; experimental training/validation limits remain, and project thresholds are separate from issued official alerts |
| Offline use | Request queuing is supported; the complete app does not operate offline, and cached alert status may be stale |
| Quiz and reports | No personal quiz history/certificates; reports are manually generated snapshots with no scheduling or saved report-history interface |
| Validation wording | Registration currently enforces a six-character password minimum while an English error says eight; use the actual visible/server result when testing |

### Existing API functions without ordinary screen controls

For completeness, the source also contains operations that a normal user cannot initiate through the current corresponding screen: pre-receipt pledge cancellation, registered-user name updates, administrator profile metadata updates, account reactivation/type-label changes, resetting guest review to Pending, and AI situational-summary generation. These should be described as available APIs, not as completed menu options. API support for a stored model field does not imply a user control for it.

## 18. Source references

These links support the described behavior and help maintain this guide when screens change. They are not extra steps ordinary users must perform.

| Guide area | Main source files |
| --- | --- |
| Account and guest access | [Authentication API](../app/routers/auth.py), [authentication checks](../app/middleware/auth.py), [registration](<../mobile/app/(auth)/register.tsx>), [guest flow](<../mobile/app/(auth)/guest.tsx>) |
| SMS/email channel selection | [OTP senders](../app/services/otp_service.py), [SMS gateway](../app/services/sms_service.py) |
| Home and profile | [Home](<../mobile/app/(people)/dashboard.tsx>), [bottom navigation/profile](../mobile/components/BottomNav.tsx), [header](../mobile/components/TopBar.tsx), [appearance](../mobile/components/AppearanceSettings.tsx) |
| Requests and local saving | [Request form](<../mobile/app/(people)/help.tsx>), [Activities](<../mobile/app/(people)/activities.tsx>), [queue](../mobile/services/requestQueue.ts), [network synchronization](../mobile/hooks/useNetworkSync.ts), [request API](../app/routers/requests.py) |
| Donor and recipient goods | [Relief goods screen](<../mobile/app/(people)/donate.tsx>), [donations API](../app/routers/donations.py), [public missions](../app/routers/missions.py) |
| Volunteer participation | [Volunteer Hub](<../mobile/app/(people)/volunteer.tsx>), [assignment API](../app/routers/volunteer_assignments.py) |
| Mobile alerts | [Feed](<../mobile/app/(people)/alerts.tsx>), [detail](<../mobile/app/(people)/alert/[id].tsx>), [alerts and community acceptance API](../app/routers/alerts.py), [notification helper](../mobile/services/notificationService.ts) |
| AI and voice | [Assistant screen](<../mobile/app/(people)/chatbot.tsx>), [primary AI router](../app/routers/ai.py), [separate AI service chatbot](../ai-service/routers/chatbot.py), [request triage](../app/services/request_triage.py) |
| Hospital lookup | [Locator screen](<../mobile/app/(people)/locator.tsx>), [primary lookup API](../app/routers/requests.py) |
| Automatic prediction | [Prediction screen](<../mobile/app/(people)/prediction.tsx>), [ML API](../ml-models/api.py), [weather inputs](../ml-models/weather.py), [model inference](../ml-models/predict.py), [weather guide](AUTOMATIC_RISK_ASSESSMENT.md) |
| Safety quiz | [Quiz screen](<../mobile/app/(people)/quiz.tsx>), [quiz API](../app/routers/quiz.py) |
| Administrator navigation and dashboard | [Layout](../resqai-admin/app/layout.tsx), [dashboard](../resqai-admin/app/dashboard/page.tsx), [statistics/report calculations](../backend/services/dashboardService.js) |
| Administrator requests | [Queue](../resqai-admin/app/requests/page.tsx), [detail](<../resqai-admin/app/requests/[id]/page.tsx>), [review API](../backend/routes/requests.js), [review rules](../backend/services/requestWorkflow.js) |
| Administrator goods and missions | [Goods screen](../resqai-admin/app/goods/page.tsx), [goods API](../backend/routes/goods.js), [mission detail](<../resqai-admin/app/missions/[id]/page.tsx>), [mission status API](../backend/routes/missions.js) |
| Administrator identity and users | [NIC review](../resqai-admin/app/guest-verification/page.tsx), [guest API](../backend/routes/guests.js), [users](../resqai-admin/app/users/page.tsx), [user API](../backend/routes/users.js) |
| Administrator alerts | [List](../resqai-admin/app/alerts/page.tsx), [new alert](../resqai-admin/app/alerts/new/page.tsx), [broadcast API](../backend/routes/alerts.js) |
| Coordination and live updates | [Chat component](../resqai-admin/components/AgencyChat.tsx), [chat API](../backend/routes/chat.js), [socket authorization/events](../backend/socket.js) |
| Operational reports | [Report screen](../resqai-admin/app/reports/page.tsx), [CSV/format helpers](../resqai-admin/lib/operations.ts), [report calculations](../backend/services/dashboardService.js) |
