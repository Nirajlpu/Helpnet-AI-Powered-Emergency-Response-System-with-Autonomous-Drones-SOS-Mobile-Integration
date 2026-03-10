package com.example.helpnet.ui.main
import com.example.helpnet.R

import com.example.helpnet.ui.emergency.SosActivity
import com.example.helpnet.ui.profile.ProfileActivity
import com.example.helpnet.service.EmergencyService
import com.example.helpnet.ui.emergency.NearbyHelpActivity
import com.example.helpnet.ui.profile.SettingsActivity
import com.example.helpnet.ui.emergency.EmergencyContactsActivity
import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.net.Uri
import android.os.*
import android.provider.MediaStore
import android.telephony.SmsManager
import android.util.Log
import android.view.MotionEvent
import android.view.animation.Animation
import android.view.animation.AnimationUtils
import android.view.animation.ScaleAnimation
import android.widget.EditText
import android.widget.ImageView
import android.widget.Toast
import androidx.annotation.RequiresPermission
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.google.android.gms.location.*
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.card.MaterialCardView
import com.google.android.material.imageview.ShapeableImageView
import kotlinx.serialization.json.Json
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import com.google.android.material.switchmaterial.SwitchMaterial
import com.example.helpnet.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class MainActivity : AppCompatActivity() {

    // Location
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private val LOCATION_PERMISSION_REQUEST_CODE = 1001

    // Camera
    private val CAMERA_PERMISSION_REQUEST_CODE = 1002
    private val VIDEO_CAPTURE_REQUEST_CODE = 1003
    private var videoUri: Uri? = null

    // Notification
    private val CHANNEL_ID = "emergency_channel"
    private val NOTIFICATION_ID = 1001

    // SOS
    private var sosCountdownTimer: CountDownTimer? = null
    private val SOS_COUNTDOWN_DURATION = 3000L // 3 seconds
    private var isSosActive = false
    // Selected incident type to include with SOS
    private var selectedIncidentType: String? = null

    // UI Elements
    private lateinit var liveLocationEditText: EditText
    // Recording state receiver (kept as a field so we can unregister it)
    private var recReceiver: android.content.BroadcastReceiver? = null

    // WebRTC Live Streaming (now handled by EmergencyService foreground service)

    private fun startWebRtcStreaming(incidentId: String) {
        // Delegate to the foreground service so streaming survives app close / screen lock
        EmergencyService.startStreaming(this, incidentId)
        Toast.makeText(this, "Live video stream started to dashboard", Toast.LENGTH_SHORT).show()
    }


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Receiver to update UI when recording starts/stops
        recReceiver = object : android.content.BroadcastReceiver() {
            override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
                val isRecording = intent?.getBooleanExtra("isRecording", false) ?: false
                if (isRecording) {

                } else {

                }
            }
        }

        // Since newer Android versions require specifying whether the receiver is exported,
        // register with RECEIVER_NOT_EXPORTED for app-internal broadcasts when available.
        val filter = android.content.IntentFilter("com.example.helpnet.RECORDING_STATE")
        try {
            recReceiver?.let { receiver ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    // Use the API-33 overload that accepts permission and handler before flags.
                    // Pass null for permission and handler, and set RECEIVER_NOT_EXPORTED for app-internal broadcasts.
                    registerReceiver(receiver, filter, null, null, Context.RECEIVER_NOT_EXPORTED)
                } else {
                    registerReceiver(receiver, filter)
                }
            }
        } catch (se: SecurityException) {
            Log.w("MainActivity", "Receiver registration skipped due to security policy: ${se.message}")
        } catch (e: Exception) {
            Log.w("MainActivity", "Failed to register receiver: ${e.message}")
        }

        // Initialize UI elements
        liveLocationEditText = findViewById(R.id.liveLocation)
        val cameraButton = findViewById<ImageView>(R.id.Camera)
        val notificationButton = findViewById<ImageView>(R.id.notification)
        val sosButton = findViewById<ShapeableImageView>(R.id.sosButton)

        // Emergency buttons
        val medicalButton = findViewById<MaterialCardView>(R.id.medicalCard)
        val fireButton = findViewById<MaterialCardView>(R.id.fire_service_card)
        val policeButton = findViewById<MaterialCardView>(R.id.police_card)
        val rescueButton = findViewById<MaterialCardView>(R.id.rescuerCard)
        val disasterButton = findViewById<MaterialCardView>(R.id.disaster_card)
        val accidentButton = findViewById<MaterialCardView>(R.id.accident_card)

        // Bottom navigation
        val bottomNav = findViewById<BottomNavigationView>(R.id.bottom_navigation)

        // Setup components
        setupBottomNavigation(bottomNav)
        setupEmergencyButtons(medicalButton, fireButton, policeButton, rescueButton, disasterButton, accidentButton)
        setupCameraButton(cameraButton)
        setupNotificationButton(notificationButton)
        setupSosButton(sosButton)

        // Initialize services
        setupLocationServices()
        createNotificationChannel()

        // Load saved Android auth token (if any) and set ApiClient.authToken for requests
        try {
            val prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
            val savedToken = prefs.getString("ANDROID_AUTH_TOKEN", "")
            if (!savedToken.isNullOrEmpty()) {
                ApiClient.authToken = savedToken
            }
        } catch (e: Exception) {
            Log.e("MainActivity", "Error loading saved auth token: ${e.message}")
        }

        // Request permissions
        requestRequiredPermissions()
    }

    // ==================== PERMISSIONS ====================
    private fun requestRequiredPermissions() {
        val permissionsNeeded = mutableListOf<String>()

        if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            permissionsNeeded.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }

        if (!hasPermission(Manifest.permission.CAMERA)) {
            permissionsNeeded.add(Manifest.permission.CAMERA)
        }

        if (!hasPermission(Manifest.permission.RECORD_AUDIO)) {
            permissionsNeeded.add(Manifest.permission.RECORD_AUDIO)
        }

        if (!hasPermission(Manifest.permission.CALL_PHONE)) {
            permissionsNeeded.add(Manifest.permission.CALL_PHONE)
        }

        if (!hasPermission(Manifest.permission.SEND_SMS)) {
            permissionsNeeded.add(Manifest.permission.SEND_SMS)
        }

        if (permissionsNeeded.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                permissionsNeeded.toTypedArray(),
                1000
            )
        }
    }

    private fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        when (requestCode) {
            CAMERA_PERMISSION_REQUEST_CODE -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    startVideoRecording()
                } else {
                    Toast.makeText(this, "Camera permission required", Toast.LENGTH_SHORT).show()
                }
            }
            LOCATION_PERMISSION_REQUEST_CODE -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    setupLocationServices()
                } else {
                    Toast.makeText(this, "Location permission required", Toast.LENGTH_SHORT).show()
                }
            }
            2000 -> {
                // Permissions requested via ensurePermissionsThenStartService
                val granted = grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }
                if (granted) {
                    // Now check for background location if needed
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)) {
                        // show rationale and request
                        if (ActivityCompat.shouldShowRequestPermissionRationale(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION)) {
                            androidx.appcompat.app.AlertDialog.Builder(this)
                                .setTitle("Background location needed")
                                .setMessage("To share live location while the app runs in background, please allow background location access.")
                                .setPositiveButton("Allow") { _, _ ->
                                    ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION), 3000)
                                }
                                .setNegativeButton("Cancel", null)
                                .show()
                        } else {
                            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION), 3000)
                        }
                    } else {
                        EmergencyService.startService(this, selectedIncidentType)
                    }
                } else {
                    Toast.makeText(this, "Required permissions denied", Toast.LENGTH_SHORT).show()
                }
            }
            3000 -> {
                // Background location result
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    EmergencyService.startService(this, selectedIncidentType)
                } else {
                    Toast.makeText(this, "Background location denied; live updates may be limited", Toast.LENGTH_LONG).show()
                    EmergencyService.startService(this, selectedIncidentType)
                }
            }
        }
    }

    // ==================== LOCATION ====================
    private fun setupLocationServices() {
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        val locationRequest = LocationRequest.create().apply {
            interval = 10000
            fastestInterval = 5000
            priority = LocationRequest.PRIORITY_HIGH_ACCURACY
        }

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    updateLocationUI(location)
                }
            }
        }

        if (hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            startLocationUpdates(locationRequest)
        } else {
            requestLocationPermission()
        }
    }

    @SuppressLint("SetTextI18n")
    private fun updateLocationUI(location: Location) {
        try {
            val geocoder = Geocoder(this, Locale.getDefault())
            @Suppress("DEPRECATION")
            val addresses = geocoder.getFromLocation(location.latitude, location.longitude, 1)

            val addressText = if (!addresses.isNullOrEmpty()) {
                addresses[0].getAddressLine(0) ?: "${location.latitude}, ${location.longitude}"
            } else {
                "${location.latitude}, ${location.longitude}"
            }

            runOnUiThread {
                liveLocationEditText.setText(addressText)
            }
        } catch (e: Exception) {
            runOnUiThread {
                liveLocationEditText.setText("${location.latitude}, ${location.longitude}")
            }
        }
    }

    private fun startLocationUpdates(locationRequest: LocationRequest) {
        if (hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            try {
                fusedLocationClient.requestLocationUpdates(
                    locationRequest,
                    locationCallback,
                    Looper.getMainLooper()
                )
            } catch (e: SecurityException) {
                Log.e("Location", "Security Exception: ${e.message}")
            }
        }
    }

    private fun requestLocationPermission() {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION),
            LOCATION_PERMISSION_REQUEST_CODE
        )
    }

    // ==================== CAMERA ====================
    private fun setupCameraButton(cameraButton: ImageView) {
        cameraButton.setOnClickListener {
            it.startAnimation(AnimationUtils.loadAnimation(this, R.anim.scale))
            if (checkCameraPermissions()) {
                startVideoRecording()
            } else {
                requestCameraPermissions()
            }
        }
    }

    private fun checkCameraPermissions(): Boolean {
        return hasPermission(Manifest.permission.CAMERA) &&
                hasPermission(Manifest.permission.RECORD_AUDIO)
    }

    private fun requestCameraPermissions() {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(
                Manifest.permission.CAMERA,
                Manifest.permission.RECORD_AUDIO
            ),
            CAMERA_PERMISSION_REQUEST_CODE
        )
    }

    private fun startVideoRecording() {
        // Use EmergencyService CameraX background recording
        if (checkCameraPermissions()) {
            EmergencyService.startRecording(this)
        } else {
            requestCameraPermissions()
        }
    }

    private fun createVideoFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir = getExternalFilesDir(Environment.DIRECTORY_MOVIES)
        storageDir?.mkdirs()

        return File.createTempFile(
            "EMERGENCY_VID_${timeStamp}_",
            ".mp4",
            storageDir
        )
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == VIDEO_CAPTURE_REQUEST_CODE) {
            when (resultCode) {
                RESULT_OK -> {
                    Toast.makeText(this, "Video saved successfully", Toast.LENGTH_SHORT).show()
                    videoUri?.let { uri ->
                        shareVideo(uri, "Emergency Video")
                    }
                }
                RESULT_CANCELED -> {
                    Toast.makeText(this, "Video recording cancelled", Toast.LENGTH_SHORT).show()
                }
                else -> {
                    Toast.makeText(this, "Failed to record video", Toast.LENGTH_SHORT).show()
                    videoUri?.let { uri ->
                        contentResolver.delete(uri, null, null)
                    }
                }
            }
        }
    }

    private fun shareVideo(videoUri: Uri, message: String) {
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "video/mp4"
            putExtra(Intent.EXTRA_STREAM, videoUri)
            putExtra(Intent.EXTRA_TEXT, message)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(Intent.createChooser(shareIntent, "Share Emergency Video"))
    }

    // ==================== SOS ====================
    private fun setupSosButton(sosButton: ShapeableImageView) {
        val zoomIn = ScaleAnimation(
            1f, 1.1f, 1f, 1.1f,
            Animation.RELATIVE_TO_SELF, 0.5f,
            Animation.RELATIVE_TO_SELF, 0.5f
        ).apply {
            duration = 100
            fillAfter = true
        }

        val zoomOut = ScaleAnimation(
            1.1f, 1f, 1.1f, 1f,
            Animation.RELATIVE_TO_SELF, 0.5f,
            Animation.RELATIVE_TO_SELF, 0.5f
        ).apply {
            duration = 100
            fillAfter = true
        }

        sosButton.setOnTouchListener { view, motionEvent ->
            when (motionEvent.action) {
                MotionEvent.ACTION_DOWN -> {
                    view.startAnimation(zoomOut)
                    startSosCountdown()
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    view.startAnimation(zoomIn)
                    cancelSosCountdown()
                    true
                }
                else -> false
            }
        }
    }

    private fun startSosCountdown() {
        if (isSosActive) return

        isSosActive = true
        sosCountdownTimer = object : CountDownTimer(SOS_COUNTDOWN_DURATION, 1000) {
            @RequiresPermission(allOf = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION])
            override fun onFinish() {
                vibrate()
                triggerSosActions()
                isSosActive = false
            }
            override fun onTick(millisUntilFinished: Long) {}
        }.start()
    }

    private fun cancelSosCountdown() {

        sosCountdownTimer?.cancel()
        isSosActive = false
    }

    private fun vibrate() {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(
                    longArrayOf(0, 500, 200, 500), -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(longArrayOf(0, 500, 200, 500), -1)
            }
        } catch (e: Exception) {
            Log.e("Vibration", "Error vibrating device", e)
        }
    }

    @RequiresPermission(allOf = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION])
    private fun triggerSosActions() {
        if (hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            fusedLocationClient.lastLocation.addOnSuccessListener { location ->
                if (location != null) {
                    // Open SOS Activity with current location
                    openSosActivity(location)

                    // Start background emergency service to stream live location to backend
                    EmergencyService.startService(this, selectedIncidentType)

                    // Start video recording via camera intent (will open camera app)
                    if (checkCameraPermissions()) {
                        startVideoRecording()
                    } else {
                        requestCameraPermissions()
                    }

                    // Send immediate SOS alert (SMS, notification) including incident type
                    val payload = mutableMapOf<String, Any>(
                        "latitude" to location.latitude,
                        "longitude" to location.longitude,
                        "device_id" to android.os.Build.MODEL,
                        "source" to "android_app",
                        "title" to "sos",
                        "description" to "sos pressed by user",
                        "reported_medium" to "SOS_BUTTON"
                    )
                    selectedIncidentType?.let { payload["incident_type"] = it }

                    ApiClient.service.postSos(payload).enqueue(object : Callback<okhttp3.ResponseBody> {
                        override fun onResponse(call: Call<okhttp3.ResponseBody>, response: Response<okhttp3.ResponseBody>) {
                            Log.d("SOS", "Posted SOS, code=${response.code()}")
                            if (response.isSuccessful) {
                                // SOS created successfully. Live location will be
                                // sent every 5 seconds via EmergencyService.
                                try {
                                    val responseString = response.body()?.string()
                                    if (!responseString.isNullOrEmpty()) {
                                        val jsonObject = org.json.JSONObject(responseString)
                                        if (jsonObject.has("incident_id")) {
                                            val incidentId = jsonObject.getString("incident_id")
                                            startWebRtcStreaming(incidentId)
                                        }
                                    }
                                } catch (e: Exception) {
                                    Log.e("SOS", "Error parsing SOS response", e)
                                }
                                runOnUiThread {
                                    Toast.makeText(this@MainActivity, "SOS Sent. Live location and video activated.", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }

                        override fun onFailure(call: Call<okhttp3.ResponseBody>, t: Throwable) {
                            Log.e("SOS", "Failed to post SOS: ${t.message}")
                        }
                    })
//                    sendSosAlert(location)
//                    callEmergencyContact()
                }
            }
        } else {
            Toast.makeText(this, "Location permission required for SOS", Toast.LENGTH_SHORT).show()
            requestLocationPermission()
        }
    }

    @RequiresPermission(Manifest.permission.POST_NOTIFICATIONS)
    private fun sendSosAlert(location: Location) {
        val emergencyContacts = getEmergencyContacts()

        if (emergencyContacts.isEmpty()) {
            Toast.makeText(this, "No emergency contacts found", Toast.LENGTH_SHORT).show()
            return
        }

        val incidentInfo = selectedIncidentType?.let { "Incident Type: $it\n" } ?: ""

        val locationText = "SOS EMERGENCY ALERT! ${incidentInfo}My current location: ${location.latitude}, ${location.longitude}\n" +
            "Google Maps: https://maps.google.com/?q=${location.latitude},${location.longitude}"

        for (contact in emergencyContacts) {
            sendSMS(contact.phoneNumber, locationText)
        }

        showNotification("SOS Alert Sent", "Emergency SOS alert sent to your contacts")

        // Post the SOS once immediately to backend via ApiClient (best-effort)
        val payload = mutableMapOf<String, Any>(
            "latitude" to location.latitude,
            "longitude" to location.longitude,
            "device_id" to android.os.Build.MODEL,
            "source" to "android_app",
            "title" to "sos",
            "description" to "sos pressed by user",
            "reported_medium" to "SOS_BUTTON"
        )
        selectedIncidentType?.let { payload["incident_type"] = it }

        ApiClient.service.postSos(payload).enqueue(object : Callback<okhttp3.ResponseBody> {
            override fun onResponse(call: Call<okhttp3.ResponseBody>, response: Response<okhttp3.ResponseBody>) {
                Log.d("SOS", "Posted SOS, code=${response.code()}")
            }

            override fun onFailure(call: Call<okhttp3.ResponseBody>, t: Throwable) {
                Log.e("SOS", "Failed to post SOS: ${t.message}")
            }

        })
    }

    private fun ensurePermissionsThenStartService() {
        val needed = mutableListOf<String>()
        if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) needed.add(Manifest.permission.ACCESS_FINE_LOCATION)
        if (!hasPermission(Manifest.permission.CAMERA)) needed.add(Manifest.permission.CAMERA)
        if (!hasPermission(Manifest.permission.RECORD_AUDIO)) needed.add(Manifest.permission.RECORD_AUDIO)

        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), 2000)
        } else {
            EmergencyService.startService(this, selectedIncidentType)
        }
    }

    private fun openSosActivity(location: Location) {
        val intent = Intent(this, SosActivity::class.java).apply {
            putExtra("LATITUDE", location.latitude)
            putExtra("LONGITUDE", location.longitude)
        }
        startActivity(intent)
    }

    private fun callEmergencyContact() {
        val emergencyContacts = getEmergencyContacts()

        if (emergencyContacts.isEmpty()) {
            Toast.makeText(this, "No emergency contacts found", Toast.LENGTH_SHORT).show()
            return
        }

        // Get the default contact if available, otherwise use the first contact
        val defaultContact = emergencyContacts.find { it.isDefault } ?: emergencyContacts[0]
        val phoneNumber = defaultContact.phoneNumber

        val intent = Intent(Intent.ACTION_CALL).apply {
            data = Uri.parse("tel:$phoneNumber")
        }

        if (hasPermission(Manifest.permission.CALL_PHONE)) {
            try {
                startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(this, "Failed to make call", Toast.LENGTH_SHORT).show()
            }
        } else {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.CALL_PHONE),
                1004
            )
        }
    }

    private fun sendSMS(phoneNumber: String, message: String) {
        if (!hasPermission(Manifest.permission.SEND_SMS)) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.SEND_SMS),
                1005
            )
            return
        }

        try {
            val smsManager = SmsManager.getDefault()
            smsManager.sendTextMessage(phoneNumber, null, message, null, null)
        } catch (e: Exception) {
            Toast.makeText(this, "Failed to send SMS", Toast.LENGTH_SHORT).show()
            Log.e("SMS", "Error sending SMS", e)
        }
    }

    // Updated to fetch contacts from EmergencyContactsActivity
    private fun getEmergencyContacts(): List<EmergencyContact> {
        val sharedPref = getSharedPreferences(EmergencyContactsActivity.PREFS_NAME, Context.MODE_PRIVATE)
        val json = sharedPref.getString(EmergencyContactsActivity.CONTACTS_KEY, null)

        return if (json != null) {
            try {
                Json.decodeFromString<List<EmergencyContactsActivity.EmergencyContact>>(json)
                    .map { contact ->
                        EmergencyContact(
                            name = contact.name,
                            phoneNumber = contact.formattedPhoneNumber(),
                            isDefault = contact.isDefault
                        )
                    }
            } catch (e: Exception) {
                Log.e("EmergencyContacts", "Error parsing contacts: ${e.message}")
                emptyList()
            }
        } else {
            // Fallback to default emergency number if no contacts are saved
            listOf(EmergencyContact("Emergency Services", "6202714697", true))
        }
    }

//     Local EmergencyContact class for MainActivity
    data class EmergencyContact(
        val name: String,
        val phoneNumber: String,
        val isDefault: Boolean = false
    )

    // ==================== NOTIFICATIONS ====================
    private fun setupNotificationButton(notificationButton: ImageView) {
        notificationButton.setOnClickListener {
            it.startAnimation(AnimationUtils.loadAnimation(this, R.anim.scale))

            showNotification("Test Notification", "This is a test emergency notification")
        }
    }



    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Emergency Notifications"
            val descriptionText = "Notifications for emergency events"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                enableLights(true)
                lightColor = android.graphics.Color.RED
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500)
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    @RequiresPermission(Manifest.permission.POST_NOTIFICATIONS)
    private fun showNotification(title: String, message: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or
                    (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0))

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .build()

        try {
            NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            Log.e("Notification", "Failed to show notification", e)
        }
    }

    // ==================== EMERGENCY BUTTONS ====================
    private fun setupEmergencyButtons(
        medicalButton: MaterialCardView,
        fireButton: MaterialCardView,
        policeButton: MaterialCardView,
        rescueButton: MaterialCardView,
        disasterButton: MaterialCardView,
        accidentButton: MaterialCardView
    ) {
        medicalButton.setOnClickListener {
            selectedIncidentType = "medical"
            handleEmergencyClick("108")
        }
        fireButton.setOnClickListener {
            selectedIncidentType = "fire"
            handleEmergencyClick("101")
        }
        policeButton.setOnClickListener {
            selectedIncidentType = "police"
            handleEmergencyClick("100")
        }
        rescueButton.setOnClickListener {
            selectedIncidentType = "rescue"
            handleEmergencyClick("112")
        }
        disasterButton.setOnClickListener {
            selectedIncidentType = "disaster"
            handleEmergencyClick("112")
        }
        accidentButton.setOnClickListener {
            selectedIncidentType = "accident"
            handleEmergencyClick("112")
        }
    }

    private fun handleEmergencyClick(phoneNumber: String) {
        val intent = Intent(Intent.ACTION_CALL).apply {
            data = Uri.parse("tel:$phoneNumber")
        }

        if (hasPermission(Manifest.permission.CALL_PHONE)) {
            try {
                startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(this, "Failed to make call", Toast.LENGTH_SHORT).show()
            }
        } else {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.CALL_PHONE),
                1006
            )
        }
    }

    // ==================== BOTTOM NAVIGATION ====================
    private fun setupBottomNavigation(bottomNav: BottomNavigationView) {
        bottomNav.setOnItemSelectedListener { menuItem ->
            when (menuItem.itemId) {
                R.id.nav_home -> {
                    Toast.makeText(this, "Home", Toast.LENGTH_SHORT).show()
                    true
                }
                R.id.nav_circle -> {
                    startActivity(Intent(this, EmergencyContactsActivity::class.java))
                    true
                }
                R.id.nav_explore -> {
                    startActivity(Intent(this, NearbyHelpActivity::class.java))
                    true
                }
                R.id.nav_profile -> {
                    startActivity(Intent(this, ProfileActivity::class.java))
                    true
                }
                else -> false
            }
        }
    }

    // ==================== LIFECYCLE ====================
    override fun onPause() {
        super.onPause()
        try {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        } catch (e: Exception) {
            Log.e("Location", "Error removing location updates", e)
        }
    }

    override fun onResume() {
        super.onResume()
        if (hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            val locationRequest = LocationRequest.create().apply {
                interval = 10000
                fastestInterval = 5000
                priority = LocationRequest.PRIORITY_HIGH_ACCURACY
            }
            startLocationUpdates(locationRequest)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        sosCountdownTimer?.cancel()
        // Unregister the recording state receiver if registered
        try {
            recReceiver?.let {
                unregisterReceiver(it)
            }
        } catch (e: Exception) {
            Log.w("MainActivity", "Error unregistering receiver: ${e.message}")
        }
    }

    companion object {
        // Add these constants to match EmergencyContactsActivity
        const val PREFS_NAME = "EmergencyContactsPrefs"
        const val CONTACTS_KEY = "emergency_contacts"
    }
}