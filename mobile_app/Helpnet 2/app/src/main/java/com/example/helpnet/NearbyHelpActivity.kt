package com.example.helpnet

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.annotation.RequiresPermission
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.material.button.MaterialButton

class NearbyHelpActivity : AppCompatActivity() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private val LOCATION_PERMISSION_REQUEST_CODE = 3001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_nearby_help)

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        // Set up filter buttons
        findViewById<MaterialButton>(R.id.btnHospitals).setOnClickListener {
            searchNearbyPlaces("hospital")
        }

        findViewById<MaterialButton>(R.id.btnPolice).setOnClickListener {
            searchNearbyPlaces("police")
        }

        findViewById<MaterialButton>(R.id.btnFireStations).setOnClickListener {
            searchNearbyPlaces("fire_station")
        }
    }

    private fun searchNearbyPlaces(placeType: String) {
        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            getLocationAndOpenMaps(placeType)
        } else {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION),
                LOCATION_PERMISSION_REQUEST_CODE
            )
        }
    }

    @RequiresPermission(allOf = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION])
    private fun getLocationAndOpenMaps(placeType: String) {
        fusedLocationClient.lastLocation.addOnSuccessListener { location ->
            if (location != null) {
                openGoogleMaps(location, placeType)
            } else {
                Toast.makeText(this, "Couldn't get location", Toast.LENGTH_SHORT).show()
                // Open maps without precise location
                openGoogleMaps(null, placeType)
            }
        }
    }

    private fun openGoogleMaps(location: Location?, placeType: String) {
        val uri = if (location != null) {
            Uri.parse("geo:${location.latitude},${location.longitude}?q=$placeType")
        } else {
            Uri.parse("geo:0,0?q=$placeType")
        }

        val mapIntent = Intent(Intent.ACTION_VIEW, uri).apply {
            setPackage("com.google.android.apps.maps")
        }

        try {
            startActivity(mapIntent)
        } catch (e: Exception) {
            // Fallback to browser if Maps app not installed
            val webUri = if (location != null) {
                Uri.parse("https://www.google.com/maps/search/?api=1&query=$placeType&center=${location.latitude},${location.longitude}")
            } else {
                Uri.parse("https://www.google.com/maps/search/?api=1&query=$placeType")
            }
            startActivity(Intent(Intent.ACTION_VIEW, webUri))
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            LOCATION_PERMISSION_REQUEST_CODE -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    // Permission granted, handle accordingly
                } else {
                    Toast.makeText(
                        this,
                        "Location permission denied - showing approximate results",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }
}