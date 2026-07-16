package com.maksoftwares.ephemera

import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

class ConnectionService : Service() {
    companion object {
        const val ACTION_START = "com.maksoftwares.ephemera.START_CONNECTION"
        const val ACTION_STOP = "com.maksoftwares.ephemera.STOP_CONNECTION"
    }

    override fun onCreate() {
        super.onCreate()
        NativeCallNotifications.createChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        val openIntent = PendingIntent.getActivity(
            this,
            201,
            Intent(this, MainActivity::class.java).apply {
                this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, NativeCallNotifications.CONNECTION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_call_notification)
            .setContentTitle("Ephemera room active")
            .setContentText("Listening for messages and incoming calls")
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

        val foregroundType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        } else {
            0
        }
        ServiceCompat.startForeground(
            this,
            NativeCallNotifications.CONNECTION_NOTIFICATION_ID,
            notification,
            foregroundType,
        )
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
