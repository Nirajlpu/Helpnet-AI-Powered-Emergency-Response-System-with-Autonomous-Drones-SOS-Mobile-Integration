package com.example.helpnet

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class EmergencyBroadcastReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            "com.example.helpnet.EMERGENCY_ALERT" -> {
                val message = intent.getStringExtra("message") ?: "Emergency Alert!"
                showEmergencyNotification(context, message)
            }
            Intent.ACTION_BOOT_COMPLETED -> {
                // Handle device reboot if needed
            }
        }
    }

    private fun showEmergencyNotification(context: Context, message: String) {
        val notificationManager = ContextCompat.getSystemService(
            context,
            NotificationManager::class.java
        ) as NotificationManager

        // Create notification channel (required for Android 8.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "emergency_alerts",
                "Emergency Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Emergency alert notifications"
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Build the notification
        val notification = NotificationCompat.Builder(context, "emergency_alerts")
            .setContentTitle("EMERGENCY ALERT")
            .setContentText(message)
            .setSmallIcon(R.drawable.ic_notification)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(1002, notification)
    }

    companion object {
        fun sendEmergencyAlert(context: Context, message: String) {
            // Create explicit intent
            val intent = Intent(context, EmergencyBroadcastReceiver::class.java).apply {
                action = "com.example.helpnet.EMERGENCY_ALERT"
                putExtra("message", message)
            }
            context.sendBroadcast(intent)
        }
    }
}