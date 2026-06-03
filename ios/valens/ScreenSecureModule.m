#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ScreenSecureModule, NSObject)

RCT_EXTERN_METHOD(setSecure:(BOOL)enabled
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isSecure:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
