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

#import "RNSketchCanvasViewComponent.h"
#import "RNTSketchCanvasManager.h"
#import "RNSketchCanvas.h"
#import "RNSketchData.h"
#import "Utility.h"

FOUNDATION_EXPORT double RNSketchCanvasVersionNumber;
FOUNDATION_EXPORT const unsigned char RNSketchCanvasVersionString[];

