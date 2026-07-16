package com.maksoftwares.ephemera

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            NativeCallNotifications.ACTION_DECLINE -> {
                MainActivity.dispatchNativeCallAction("decline")
                NativeCallNotifications.dismiss(context)
            }
            NativeCallNotifications.ACTION_ANSWER -> {
                NativeCallNotifications.dismiss(context)
                val open = Intent(context, MainActivity::class.java).apply {
                    putExtra(NativeCallNotifications.EXTRA_CALL_ACTION, "answer")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                }
                context.startActivity(open)
            }
        }
    }
}
