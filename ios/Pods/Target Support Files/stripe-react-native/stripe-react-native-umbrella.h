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

#import "StripeSdkEventEmitterCompat.h"
#import "StripeSdk-Bridging-Header.h"
#import "stripe_react_native.h"

FOUNDATION_EXPORT double stripe_react_nativeVersionNumber;
FOUNDATION_EXPORT const unsigned char stripe_react_nativeVersionString[];

