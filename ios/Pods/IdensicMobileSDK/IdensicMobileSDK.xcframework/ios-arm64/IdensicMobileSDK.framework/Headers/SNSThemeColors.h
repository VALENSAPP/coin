//
//  SNSThemeColors.h
//  IdensicMobileSDK
//

#import "SNSThemeSection.h"

@interface SNSThemeColors : SNSThemeSection

#pragma mark - Common

/// Navigation bar items tinting color. Used for the close button only at the moment.
@property (nonatomic, nonnull) UIColor *navigationBarItem;

/// Used for the system alert actions.
@property (nonatomic, nonnull) UIColor *alertTint;


#pragma mark - Backgrounds

/// Used for almost all the screens as the background color (the exception is the Camera Screen, see `cameraBackground`).
@property (nonatomic, nonnull) UIColor *backgroundCommon;

/// Used as a background state color for the verification steps and as a main background color for the `.filled`-style cards.
@property (nonatomic, nonnull) UIColor *backgroundNeutral;

/// Not used at the moment.
@property (nonatomic, nonnull) UIColor *backgroundInfo;

/// Used as a background state color for the verification steps and as a background color for the auto-generated `images.pictureSuccess`.
@property (nonatomic, nonnull) UIColor *backgroundSuccess;

/// Used as a background state color for the verification steps and as a background color for the auto-generated `images.pictureWarning` and `images.pictureSubmitted`.
@property (nonatomic, nonnull) UIColor *backgroundWarning;

/// Used as a background state color for the verification steps and as a background color for the auto-generated `images.pictureFailure`.
@property (nonatomic, nonnull) UIColor *backgroundCritical;


#pragma mark - Content

/// Used for the text links.
@property (nonatomic, nonnull) UIColor *contentLink;

/// Used as a foreground color for the headlines and some subtitles.
@property (nonatomic, nonnull) UIColor *contentStrong;

/// Used as a foreground color for the text body, some subtitles and the accessory elements.
@property (nonatomic, nonnull) UIColor *contentNeutral;

/// Used as a foreground color for the minor captions and the light accessory elements.
@property (nonatomic, nonnull) UIColor *contentWeak;

/// Used for the Video Screen's viewport border only at the moment.
@property (nonatomic, nonnull) UIColor *contentInfo;

/// Used as a foreground state color for the verification steps and as a foreground color for the auto-generated `images.pictureSuccess`.
@property (nonatomic, nonnull) UIColor *contentSuccess;

/// Used as a foreground state color for the verification steps and as a foreground color for the auto-generated `images.pictureWarning` and `images.pictureSubmitted`.
@property (nonatomic, nonnull) UIColor *contentWarning;

/// Used as a foreground state color for the verification steps and as a foreground color for the auto-generated `images.pictureFailure`.
@property (nonatomic, nonnull) UIColor *contentCritical;


#pragma mark - Primary Button

/// The primary button background color in the normal state.
@property (nonatomic, nonnull) UIColor *primaryButtonBackground;

/// The primary button background color in the highlighted state.
@property (nonatomic, nonnull) UIColor *primaryButtonBackgroundHighlighted;

/// The primary button background color in the disabled state.
@property (nonatomic, nonnull) UIColor *primaryButtonBackgroundDisabled;

/// The primary button foreground color in the normal state.
@property (nonatomic, nonnull) UIColor *primaryButtonContent;

/// The primary button foreground color in the highlighted state.
@property (nonatomic, nonnull) UIColor *primaryButtonContentHighlighted;

/// The primary button foreground color in the disabled state.
@property (nonatomic, nonnull) UIColor *primaryButtonContentDisabled;


#pragma mark - Secondary Button

/// The secondary button background color in the normal state.
@property (nonatomic, nonnull) UIColor *secondaryButtonBackground;

/// The secondary button background color in the highlighted state.
@property (nonatomic, nonnull) UIColor *secondaryButtonBackgroundHighlighted;

/// The secondary button background color in the disabled state.
@property (nonatomic, nonnull) UIColor *secondaryButtonBackgroundDisabled;

/// The secondary button foreground color in the normal state.
@property (nonatomic, nonnull) UIColor *secondaryButtonContent;

/// The secondary button foreground color in the highlighted state.
@property (nonatomic, nonnull) UIColor *secondaryButtonContentHighlighted;

/// The secondary button foreground color in the disabled state.
@property (nonatomic, nonnull) UIColor *secondaryButtonContentDisabled;


#pragma mark - Field Button

/// The field button background color in the highlighted state. Used for the phone field's country button.
@property (nonatomic, nonnull) UIColor *fieldButtonBackgroundHighlighted;


#pragma mark - Link Button

/// The link button background color in the highlighted state.
@property (nonatomic, nonnull) UIColor *linkButtonBackgroundHighlighted;

/// The link button foreground color in the normal state.
@property (nonatomic, nonnull) UIColor *linkButtonContent;

/// The link button foreground color in the disabled state.
@property (nonatomic, nonnull) UIColor *linkButtonContentDisabled;


#pragma mark - Card

/// Used as a background color for the cards with `.plain` card style.
@property (nonatomic, nullable) UIColor *cardPlainBackground;

/// Used as a background color for the cards with `.bordered` card style.
@property (nonatomic, nullable) UIColor *cardBorderedBackground;


#pragma mark - Camera

/// The Camera Screen's background color.
@property (nonatomic, nonnull) UIColor *cameraBackground;

/// The Camera Screen's overlay background color.
@property (nonatomic, nonnull) UIColor *cameraBackgroundOverlay;

/// Used as a tint color for the elements placed on the Camera Screen such as the gallery button, the touch button, etc.
@property (nonatomic, nonnull) UIColor *cameraContent;


#pragma mark - Field

/// The background color of the input fields. Used for text fields.
@property (nonatomic, nonnull) UIColor *fieldBackground;

/// The background color of the input fields marked as invalid. Used for text fields.
@property (nonatomic, nonnull) UIColor *fieldBackgroundInvalid;

/// The border color of the input fields. Used for text fields.
@property (nonatomic, nonnull) UIColor *fieldBorder;

/// The placeholder color of the input fields. Used for text fields.
@property (nonatomic, nonnull) UIColor *fieldPlaceholder;

/// The content color of the input fields. Used for text fields.
@property (nonatomic, nonnull) UIColor *fieldContent;

/// The tint color of the input fields. Used for text fields, checkboxes and radio buttons.
@property (nonatomic, nonnull) UIColor *fieldTint;


#pragma mark - List

/// The list separator color.
@property (nonatomic, nonnull) UIColor *listSeparator;

/// The background color of the selected list item.
@property (nonatomic, nonnull) UIColor *listSelectedItemBackground;


#pragma mark - Bottom Sheet

/// The foreground color of the bottom sheet handle.
///
/// @discussion
/// Note that the handle can be both inside (on `bottomSheetBackground` color) and outside (on the `backgroundCommon` color) of the bottom sheet.
@property (nonatomic, nonnull) UIColor *bottomSheetHandle;

/// The background color of the bottom sheet.
@property (nonatomic, nonnull) UIColor *bottomSheetBackground;


#pragma mark - Toolbar

/// Used for the toolbar buttons.
@property (nonatomic, nonnull) UIColor *toolbarTint;

/// Used as a background color for the toolbar.
@property (nonatomic, nullable) UIColor *toolbarBackground;


#pragma mark - Progress Bar

/// The shimmer color of the progress bars.
@property (nonatomic, nonnull) UIColor *progressBarShimmer;

/// The tint color of the progress bars.
@property (nonatomic, nonnull) UIColor *progressBarTint;

/// Used as a background color for the progress bars.
@property (nonatomic, nonnull) UIColor *progressBarBackground;

@end
