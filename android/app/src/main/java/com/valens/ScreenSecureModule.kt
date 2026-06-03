package com.valens

import android.app.Activity
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ScreenSecureModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun setSecure(enabled: Boolean, promise: Promise) {
    val activity: Activity? = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Activity is not available")
      return
    }

    activity.runOnUiThread {
      try {
        if (enabled) {
          activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
          activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("SECURE_FLAG_ERROR", error.message, error)
      }
    }
  }

  @ReactMethod
  fun isSecure(promise: Promise) {
    val activity: Activity? = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }

    activity.runOnUiThread {
      val flags = activity.window.attributes.flags
      val secure = flags and WindowManager.LayoutParams.FLAG_SECURE != 0
      promise.resolve(secure)
    }
  }

  companion object {
    const val NAME = "ScreenSecure"
  }
}
