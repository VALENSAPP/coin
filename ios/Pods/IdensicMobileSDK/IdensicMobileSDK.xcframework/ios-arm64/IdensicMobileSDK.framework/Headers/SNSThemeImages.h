//
//  SNSThemeImages.h
//  IdensicMobileSDK
//

#import "SNSThemeSection.h"

@interface SNSThemeImages : SNSThemeSection

#pragma mark - Icons (templates)

/// Used for the close bar button across all the screens.
/// Default is a cross icon.
@property (nonatomic, nonnull) UIImage *iconClose;

/// Used for the back bar button.
/// Default is a back arrow icon. Setting to `nil` forces the system back button to be used instead.
@property (nonatomic, nullable) UIImage *iconBack;

/// Used for the search bar.
/// Default is a magnifying glass icon.
@property (nonatomic, nonnull) UIImage *iconSearch;

/// Used for add buttons.
/// Default is a plus icon.
@property (nonatomic, nonnull) UIImage *iconAdd;

/// Used to indicate the disclosability.
/// Default is a simple disclosing arrow icon.
@property (nonatomic, nonnull) UIImage *iconDisclosure;

/// Used for dropdown fields.
/// Default is a down arrow icon.
@property (nonatomic, nonnull) UIImage *iconDropdown;

/// Used for date fields.
/// Default is a calendar icon.
@property (nonatomic, nonnull) UIImage *iconCalendar;

/// Used for attachments fields when the field is empty.
/// Default is a clip icon.
@property (nonatomic, nonnull) UIImage *iconAttachment;

/// Used for attachments fields when the document is attached.
/// Default is a picture icon.
@property (nonatomic, nonnull) UIImage *iconPicture;

/// Used for the Sumsub ID.
/// Default is a person icon.
@property (nonatomic, nonnull) UIImage *iconPerson;

/// Used for the Sumsub ID.
/// Default is a lock icon.
@property (nonatomic, nonnull) UIImage *iconLock;

/// Used for the Sumsub ID.
/// Default is a filled flash icon.
@property (nonatomic, nonnull) UIImage *iconInstantAction;


/// Used for attachments fields when the document can be removed.
/// Default is a trash bin icon.
@property (nonatomic, nonnull) UIImage *iconBin;

/// Used for the turned-on flashlight button on the Camera Screen.
/// Default is a filled flash icon.
@property (nonatomic, nonnull) UIImage *iconTorchOn;

/// Used for the turned-off flashlight button on the Camera Screen.
/// Default is an outlined flash icon.
@property (nonatomic, nonnull) UIImage *iconTorchOff;

/// Used for the gallery button on the Camera Screen.
/// Default is a photos stack icon.
@property (nonatomic, nonnull) UIImage *iconGallery;

/// Used for the camera info button on the Camera Screen.
/// Default is a rounded i icon.
@property (nonatomic, nonnull) UIImage *iconInfo;

/// Used for the camera toggle button on the VideoIdent Screen.
/// Default is a rounded arrows icon.
@property (nonatomic, nonnull) UIImage *iconCameraToggle;

/// Used for the rotation bar button on the Preview Screen.
/// Default is a photo rotation icon.
@property (nonatomic, nonnull) UIImage *iconRotate;

/// Used for the default E-Mail support item.
/// Default is a letter icon.
@property (nonatomic, nonnull) UIImage *iconMail;

/// Used for the play button on the Preview screen.
/// Default is a play icon in the circle.
@property (nonatomic, nonnull) UIImage *iconPlay;

/// Used on the verification comment block at the Status Screen
/// Default is an exclamation mark in the triangle.
@property (nonatomic, nonnull) UIImage *iconNotice;

/// Used to mark items to be opened externally
/// Default is a square with a diagonal arrow at the top right corner.
@property (nonatomic, nonnull) UIImage *iconExternalLink;

/// Used for unmarked checkboxes.
/// Default is an empty rectangle icon with `contentWeak` border color.
@property (nonatomic, nonnull) UIImage *iconCheckboxOff;

/// Used for marked checkboxes.
/// Default is a white checkmark icon on a background rectangle with `fieldTint` color.
@property (nonatomic, nonnull) UIImage *iconCheckboxOn;

/// Used for unselected radio buttons.
/// Default is an empty circle icon with `contentWeak` border color.
@property (nonatomic, nonnull) UIImage *iconRadioButtonOff;

/// Used for selected radio buttons.
/// Default is a white circle icon on a backround circle with `fieldTint` color.
@property (nonatomic, nonnull) UIImage *iconRadioButtonOn;

/// Used for "Other" option on Agreement screen.
/// Default is a earth icon.
@property (nonatomic, nonnull) UIImage *iconOtherCountry;
 
/// Used to compose the auto-generated `pictureSuccess` and `pictureEidDone`.
/// Default is a check mark icon.
@property (nonatomic, nonnull) UIImage *iconSuccess;

/// Used in lists
/// Default is a check mark in a small filled circle.
@property (nonatomic, nonnull) UIImage *iconSuccessFilled;

/// Used for the warnings bottom sheet and to compose the auto-generated `pictureWarning`.
/// Default is an exclamation mark in the triangle.
@property (nonatomic, nonnull) UIImage *iconWarning;

/// Used to compose the auto-generated `pictureFailure`.
/// Default is a cross icon.
@property (nonatomic, nonnull) UIImage *iconFailure;

/// Used in lists
/// Default is a cross in a small filled circle.
@property (nonatomic, nonnull) UIImage *iconFailureFilled;

/// Used to compose the auto-generated `pictureSubmitted`.
/// Default is an uploading-to-the-cloud icon.
@property (nonatomic, nonnull) UIImage *iconSubmitted;

/// Used on the wordless fatal error screen. Look at: https://docs.sumsub.com/docs/ios-theme-guide#wordless
/// Default is a robot icon.
@property (nonatomic, nonnull) UIImage *pictureWordlessFatalFailure;

/// Used on the wordless network error screen. Look at: https://docs.sumsub.com/docs/ios-theme-guide#wordless
/// Default is a robot icon.
@property (nonatomic, nonnull) UIImage *pictureWordlessNetworkFailure;

/// Used on the wordless error screen. Look at: https://docs.sumsub.com/docs/ios-theme-guide#wordless
/// Default is a back icon.
@property (nonatomic, nonnull) UIImage *iconWordlessGoBackButton;

/// Used on the wordless error screen. Look at: https://docs.sumsub.com/docs/ios-theme-guide#wordless
/// Default is a retry icon.
@property (nonatomic, nonnull) UIImage *iconWordlessRetryButton;

#pragma mark - Pictures

/// The "success" image. Could be used if you'd like to override the auto-generated one.
/// Default is `nil`
///
/// @discussion
/// The auto-generated image looks like the `iconSuccess` icon in the circles composed on the basis of the `colors.contentSuccess` and `colors.backgroundSuccess` colors.
@property (nonatomic, nullable) UIImage *pictureSuccess;

/// The "warning" image. Could be used if you'd like to override the auto-generated one.
/// Default is `nil`
///
/// @discussion
/// The auto-generated image looks like the `iconWarning` icon in the circles composed on the basis of the `colors.contentWarning` and `colors.backgroundWarning` colors.
@property (nonatomic, nullable) UIImage *pictureWarning;

/// The "failure" image. Could be used if you'd like to override the auto-generated one.
/// Default is `nil`
///
/// @discussion
/// The auto-generated image looks like the `iconFailure` icon in the circles composed on the basis of the `colors.contentCritical` and `colors.backgroundFailure` colors.
@property (nonatomic, nullable) UIImage *pictureFailure;

/// The "submitted" image. Could be used if you'd like to override the auto-generated one.
/// Default is `nil`
///
/// @discussion
/// The auto-generated image looks like the `iconSubmitted` icon in the circles composed on the basis of the `colors.contentWarning` and `colors.backgroundWarning` colors.
@property (nonatomic, nullable) UIImage *pictureSubmitted;

/// Used as the image on the Geolocation Screen before the start of geolocation detection.
/// Default is a geolocation pin icon.
@property (nonatomic, nullable) UIImage *pictureGeolocationOn;

/// Used as the image on the Geolocation Screen when the app has no permissions to get the geolocation.
/// Default is a crossed geolocation pin icon.
@property (nonatomic, nullable) UIImage *pictureGeolocationOff;

/// Displayed at the top of the Agreement Screen.
/// Default is a globe decorated.
@property (nonatomic, nullable) UIImage *pictureAgreement;

/// Displayed at the Camera Screen before the back side of a document is going to be captured.
/// Default is an ID document with a rotating arrow below.
@property (nonatomic, nullable) UIImage *pictureDocumentFlip;

/// Shown on the error screen when VPN usage is restricted.
/// Default is a circle with "vpn" caption.
@property (nonatomic, nullable) UIImage *pictureRestrictionVpn;

/// Displayed at the eID Pin Type Screen.
/// Default is an eID document in the hand.
@property (nonatomic, nullable) UIImage *pictureEidCard;

/// Displayed at the eID Ident Info Screen.
/// Default is an phone with PIN code field.
@property (nonatomic, nullable) UIImage *pictureEidPinCode;

/// Displayed after eID Pin Pad Screen when CAN is required.
/// Default is an eID document with a showed CAN code.
@property (nonatomic, nullable) UIImage *pictureEidCanCode;

/// The "pictureEidDone" image. Could be used if you'd like to override the auto-generated one.
/// Default is `nil`
///
/// @discussion
/// The auto-generated image looks like the `iconSuccess` icon in the circles composed on the basis of the `colors.contentInfo` and `colors.backgroundInfo` colors.
@property (nonatomic, nullable) UIImage *pictureEidDone;

/// The ID card image used in the MRTD and eID animation on the Scanning screen.
/// Default is an ID card.
@property (nonatomic, nullable) UIImage *mrtdAnimationID;

/// The passport image used in the MRTD and eID animation on the Scanning screen.
/// Default is an opened passport.
@property (nonatomic, nullable) UIImage *mrtdAnimationPassport;

/// The phone image used in the MRTD and eID animation on the Scanning screen.
/// Default is a phone in the hand.
@property (nonatomic, nullable) UIImage *mrtdAnimationPhone;

/// The inactive NFC image used in the MRTD and eID animation on the Scanning screen.
/// Default is 3 gray airwaves.
@property (nonatomic, nullable) UIImage *mrtdAnimationWaiting;

/// The active NFC image used in the MRTD and eID animation on the Scanning screen.
/// Default is 3 blue airwaves.
@property (nonatomic, nullable) UIImage *mrtdAnimationReading;

/// The success NFC image used in the MRTD and eID animation on the Scanning screen.
/// Default is a blue checkmark icon in the circle.
@property (nonatomic, nullable) UIImage *mrtdAnimationSuccess;


#pragma mark - Verification Steps

/// Verification steps icons.
///
/// Default icons are defined for the following keys: `.identity`, `.selfie`, `.selfie2`, `.proofOfResidence`, `.proofOfResidence2`, `.applicantData`, `.emailVerification`, `.phoneVerification`, `.questionnaire`, `.videoIdent` and `.ekyc`.
/// Also the `.default` key is filled with the `.identity` icon.
@property (nonatomic, nonnull) NSDictionary<SNSVerificationStepKey, UIImage *> *verificationStepIcons;

- (void)setIcon:(UIImage * _Nullable)icon forVerificationStep:(SNSVerificationStepKey _Nonnull)step NS_SWIFT_UNAVAILABLE("Use .verificationStepIcons instead.");

/// Verification steps icons by the step' states
///
/// By default the same icons are used for any step state, see `metrics.verificationStepIcons`, here is the way to adjust more preciously if required
- (void)setIcon:(UIImage * _Nullable)icon forVerificationStep:(SNSVerificationStepKey _Nonnull)step andState:(SNSVerificationStepState _Nonnull)state;


#pragma mark - Documents

/// Document types icons.
///
/// Default icons are defined for the following keys: `.idCard`, `.passport`, `.drivers` and `.residencePermit`.
/// Also the `.default` key is filled with the `.idCard` icon.
@property (nonatomic, nonnull) NSDictionary<SNSDocumentTypeKey, UIImage *> *documentTypeIcons;

- (void)setIcon:(UIImage * _Nullable)icon forDocumentType:(SNSDocumentTypeKey _Nonnull)documentType NS_SWIFT_UNAVAILABLE("Use .documentTypeIcons instead.");


#pragma mark - Instructions

/// Instruction pictures.
///
/// When an image is referred with one of the following text keys:
///
/// @textblock
/// - `sns_step_{STEP}_{scene}_instructions_image`
/// - `sns_step_{STEP}_{scene}_instructions_doImage`
/// - `sns_step_{STEP}_{scene}_instructions_dontImage`
/// @/textblock
///
/// the sdk will look through `instructionsImages` for the corresponding image object.
/// At that it takes the value of the text key and uses it as a key for `instructionsImages` dictionary.
///
/// Feel free to add your own pictures or use the predefined ones:
///
/// @textblock
/// - `default/videoident`
/// - `default/facescan`
/// - `default/do_idCard`
/// - `default/dont_idCard`
/// - `default/do_passport`
/// - `default/dont_passport`
/// - `default/do_idCard_backSide`
/// - `default/dont_idCard_backSide`
/// @/textblock
///
@property (nonatomic, nonnull) NSDictionary<NSString *, UIImage *> *instructionsImages;

- (void)setInstructionsImage:(UIImage * _Nullable)image forKey:(NSString * _Nonnull)imageKey NS_SWIFT_UNAVAILABLE("Use .documentTypeIcons instead.");

@end
