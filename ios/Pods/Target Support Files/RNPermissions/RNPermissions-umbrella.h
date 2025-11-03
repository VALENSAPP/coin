#ifdef __OBJC__
#import <UIKit/UIKit.h>
#else
#ifndef FOUNDATION_EXPORT
#if defined(__cplusplus)
#define FOUNDATION_EXPORT extern "C"
#else
#define FOUNDATION_EXPORT extern
#endif
#endif
#endif

#import "RNPermissions.h"
#import "RNPermissionHandlerStoreKit.h"
#import "RNPermissionHandlerFaceID.h"
#import "RNPermissionHandlerCalendars.h"
#import "RNPermissionHandlerLocationAlways.h"
#import "RNPermissionHandlerPhotoLibraryAddOnly.h"
#import "RNPermissionHandlerMicrophone.h"
#import "RNPermissionHandlerSpeechRecognition.h"
#import "RNPermissionHandlerLocationWhenInUse.h"
#import "RNPermissionHandlerPhotoLibrary.h"
#import "RNPermissionHandlerCamera.h"
#import "RNPermissionHandlerContacts.h"
#import "RNPermissionHandlerMotion.h"
#import "RNPermissionHandlerCalendarsWriteOnly.h"
#import "RNPermissionHandlerAppTrackingTransparency.h"
#import "RNPermissionHandlerLocationAccuracy.h"
#import "RNPermissionHandlerBluetooth.h"
#import "RNPermissionHandlerMediaLibrary.h"
#import "RNPermissionHandlerNotifications.h"
#import "RNPermissionHandlerReminders.h"

FOUNDATION_EXPORT double RNPermissionsVersionNumber;
FOUNDATION_EXPORT const unsigned char RNPermissionsVersionString[];

