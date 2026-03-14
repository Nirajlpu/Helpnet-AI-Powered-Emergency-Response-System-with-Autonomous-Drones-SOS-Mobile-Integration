package com.example.helpnet.ui.emergency
import com.example.helpnet.R

import android.content.Context
import android.os.Bundle
import android.os.CountDownTimer
import android.preference.PreferenceManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import com.example.helpnet.service.EmergencyService

class SosActivity : AppCompatActivity() {
    companion object {
        private const val REQUEST_CODE_PIN = 1001
    }

    private lateinit var mapSos: MapView
    private lateinit var countdownTextView: TextView
    private lateinit var cancelButton: Button
    private var countdownTimer: CountDownTimer? = null

    private var latitude: Double = 0.0
    private var longitude: Double = 0.0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Initialize osmdroid configuration using application context and user agent
        val ctx: Context = applicationContext
        Configuration.getInstance().load(ctx, PreferenceManager.getDefaultSharedPreferences(ctx))
        Configuration.getInstance().userAgentValue = packageName
        
        setContentView(R.layout.activity_sos)

        // Get location from intent
        latitude = intent.getDoubleExtra("LATITUDE", 0.0)

        longitude = intent.getDoubleExtra("LONGITUDE", 0.0)

        // Initialize UI elements
        countdownTextView = findViewById(R.id.textViewCountdown)
        cancelButton = findViewById(R.id.btnCancelSos)
        mapSos = findViewById(R.id.mapSos)

        // Setup Map
        mapSos.setTileSource(TileSourceFactory.MAPNIK)
        mapSos.setMultiTouchControls(true)
        val mapController = mapSos.controller
        mapController.setZoom(15.0)

        val startPoint = GeoPoint(latitude, longitude)
        mapController.setCenter(startPoint)

        // Add user location marker
        val startMarker = Marker(mapSos)
        startMarker.position = startPoint
        startMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
        startMarker.title = "Your Location"
        mapSos.overlays.add(startMarker)
        mapSos.invalidate() // refresh map

        // Set up cancel button
        cancelButton.setOnClickListener {
            // Launch PasswordActivity for PIN verification
            val intent = android.content.Intent(this, com.example.helpnet.ui.auth.PasswordActivity::class.java)
            startActivityForResult(intent, REQUEST_CODE_PIN)
        }

        // Start countdown
        startCountdown()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_CODE_PIN && resultCode == android.app.Activity.RESULT_OK) {
            // Correct PIN entered, stop EmergencyService
            val stopIntent = android.content.Intent(this, EmergencyService::class.java).apply {
                action = EmergencyService.ACTION_FORCE_STOP
            }
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                startForegroundService(stopIntent)
            } else {
                startService(stopIntent)
            }
            countdownTimer?.cancel()
            finish()
        }
    }

    private fun startCountdown() {
        // 60 second countdown
        countdownTimer = object : CountDownTimer(60000, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val secondsRemaining = millisUntilFinished / 1000
                countdownTextView.text = "Emergency services notified\nHelp arriving in: $secondsRemaining seconds"
            }

            override fun onFinish() {
                countdownTextView.text = "Emergency services have been notified"
            }
        }.start()
    }

    override fun onResume() {
        super.onResume()
        mapSos.onResume()
    }

    override fun onPause() {
        super.onPause()
        mapSos.onPause()
    }

    override fun onDestroy() {
        super.onDestroy()
        countdownTimer?.cancel()
    }
}
