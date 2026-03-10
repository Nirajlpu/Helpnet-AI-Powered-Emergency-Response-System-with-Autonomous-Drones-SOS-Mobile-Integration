package com.example.helpnet

import android.os.Bundle
import android.os.CountDownTimer
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.example.helpnet.R
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MarkerOptions

class SosActivity : AppCompatActivity(), OnMapReadyCallback {

    private lateinit var mMap: GoogleMap
    private lateinit var countdownTextView: TextView
    private lateinit var cancelButton: Button
    private var countdownTimer: CountDownTimer? = null

    private var latitude: Double = 0.0
    private var longitude: Double = 0.0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_sos)

        // Get location from intent
        latitude = intent.getDoubleExtra("LATITUDE", 0.0)
        longitude = intent.getDoubleExtra("LONGITUDE", 0.0)

        // Initialize UI elements
        countdownTextView = findViewById(R.id.textViewCountdown)
        cancelButton = findViewById(R.id.btnCancelSos)

        // Initialize map
        val mapFragment = supportFragmentManager
            .findFragmentById(R.id.mapSos) as SupportMapFragment
        mapFragment.getMapAsync(this)

        // Set up cancel button
        cancelButton.setOnClickListener {
            // Cancel SOS
            countdownTimer?.cancel()
            finish()
        }

        // Start countdown
        startCountdown()
    }

    override fun onMapReady(googleMap: GoogleMap) {
        mMap = googleMap

        // Add marker for current location
        val currentLatLng = LatLng(latitude, longitude)
        mMap.addMarker(MarkerOptions()
            .position(currentLatLng)
            .title("Your Location"))

        mMap.moveCamera(CameraUpdateFactory.newLatLngZoom(currentLatLng, 15f))
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

    override fun onDestroy() {
        super.onDestroy()
        countdownTimer?.cancel()
    }
}