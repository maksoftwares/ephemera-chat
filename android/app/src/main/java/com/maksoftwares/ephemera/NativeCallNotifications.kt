package com.maksoftwares.ephemera

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.content.ContextCompat

object NativeCallNotifications {
    const val ACTION_ANSWER = "com.maksoftwares.ephemera.ANSWER_CALL"
    const val ACTION_DECLINE = "com.maksoftwares.ephemera.DECLINE_CALL"
    const val EXTRA_CALL_ACTION = "call_action"
    const val EXTRA_CALLER = "caller"
    const val EXTRA_CALL_TYPE = "call_type"

    const val CALL_CHANNEL_ID = "ephemera_calls"
    const val CONNECTION_CHANNEL_ID = "ephemera_connection"
    const val CALL_NOTIFICATION_ID = 4101
    const val CONNECTION_NOTIFICATION_ID = 4102

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        val ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val calls = NotificationChannel(
            CALL_CHANNEL_ID,
            context.getString(R.string.call_channel_name),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Incoming Ephemera voice and video calls"
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 650, 250, 650, 700)
            setSound(ringtone, audioAttributes)
        }

        val connection = NotificationChannel(
            CONNECTION_CHANNEL_ID,
            context.getString(R.string.connection_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Keeps the current peer-to-peer room connected"
            setSound(null, null)
            enableVibration(false)
        }

        manager.createNotificationChannels(listOf(calls, connection))
    }

    fun showIncomingCall(context: Context, caller: String, callType: String) {
        createChannels(context)

        val answerIntent = Intent(context, CallActionReceiver::class.java).apply { action = ACTION_ANSWER }
        val declineIntent = Intent(context, CallActionReceiver::class.java).apply { action = ACTION_DECLINE }
        val fullScreenIntent = Intent(context, IncomingCallActivity::class.java).apply {
            putExtra(EXTRA_CALLER, caller)
            putExtra(EXTRA_CALL_TYPE, callType)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        val answerPendingIntent = PendingIntent.getBroadcast(
            context, 101, answerIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val declinePendingIntent = PendingIntent.getBroadcast(
            context, 102, declineIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val fullScreenPendingIntent = PendingIntent.getActivity(
            context, 103, fullScreenIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val person = Person.Builder()
            .setName(caller.ifBlank { "Ephemera participant" })
            .setImportant(true)
            .build()

        val notification = NotificationCompat.Builder(context, CALL_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_call_notification)
            .setContentTitle(callType.ifBlank { "Incoming call" })
            .setContentText("${person.name} is calling")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(person, declinePendingIntent, answerPendingIntent))
            .build()

        if (
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        ) {
            NotificationManagerCompat.from(context).notify(CALL_NOTIFICATION_ID, notification)
        }
    }

    fun dismiss(context: Context) {
        NotificationManagerCompat.from(context).cancel(CALL_NOTIFICATION_ID)
        IncomingCallActivity.finishCurrent()
    }
}
