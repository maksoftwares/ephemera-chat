package com.maksoftwares.ephemera

import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.lang.ref.WeakReference

class IncomingCallActivity : AppCompatActivity() {
    companion object {
        private var current: WeakReference<IncomingCallActivity>? = null
        fun finishCurrent() {
            current?.get()?.runOnUiThread { current?.get()?.finishAndRemoveTask() }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        current = WeakReference(this)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
            )
        }

        val caller = intent.getStringExtra(NativeCallNotifications.EXTRA_CALLER).orEmpty().ifBlank { "Ephemera participant" }
        val callType = intent.getStringExtra(NativeCallNotifications.EXTRA_CALL_TYPE).orEmpty().ifBlank { "Incoming call" }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 64, 48, 64)
            setBackgroundColor(Color.rgb(9, 11, 18))
        }

        root.addView(TextView(this).apply {
            text = callType
            setTextColor(Color.rgb(155, 162, 181))
            textSize = 18f
            gravity = Gravity.CENTER
        })
        root.addView(TextView(this).apply {
            text = caller
            setTextColor(Color.WHITE)
            textSize = 30f
            gravity = Gravity.CENTER
            setPadding(0, 22, 0, 54)
        })

        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        val decline = Button(this).apply {
            text = "Decline"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(218, 60, 83))
            setOnClickListener {
                MainActivity.dispatchNativeCallAction("decline")
                NativeCallNotifications.dismiss(this@IncomingCallActivity)
                finishAndRemoveTask()
            }
        }
        val answer = Button(this).apply {
            text = "Answer"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(54, 185, 133))
            setOnClickListener {
                NativeCallNotifications.dismiss(this@IncomingCallActivity)
                startActivity(Intent(this@IncomingCallActivity, MainActivity::class.java).apply {
                    putExtra(NativeCallNotifications.EXTRA_CALL_ACTION, "answer")
                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                })
                finishAndRemoveTask()
            }
        }
        controls.addView(decline, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = 14 })
        controls.addView(answer, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = 14 })
        root.addView(controls, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        setContentView(root)
    }

    override fun onDestroy() {
        if (current?.get() === this) current = null
        super.onDestroy()
    }
}
