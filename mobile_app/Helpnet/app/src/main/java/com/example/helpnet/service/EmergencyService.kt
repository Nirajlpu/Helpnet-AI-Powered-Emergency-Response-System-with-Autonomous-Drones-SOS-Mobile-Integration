package com.example.helpnet.service
import com.example.helpnet.R

import com.example.helpnet.ui.auth.PasswordActivity
import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.location.Location
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.Environment
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import android.app.AlarmManager
import android.app.PendingIntent
import androidx.core.app.NotificationCompat

import android.widget.Toast
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.PendingRecording
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import com.example.helpnet.network.ApiClient
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

class EmergencyService : LifecycleService() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var incidentType: String? = null

    // Frame streaming to backend
    private var incidentId: String? = null
    @Volatile private var latestFrameBytes: ByteArray? = null
    private var frameScheduler: ScheduledExecutorService? = null
    private var frameTask: ScheduledFuture<*>? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var cameraProviderRef: ProcessCameraProvider? = null

    // Audio streaming to backend
    private var audioRecord: AudioRecord? = null
    private var audioThread: Thread? = null
    @Volatile private var isAudioStreaming = false

    override fun onBind(intent: Intent) = super.onBind(intent)

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        val hasLocationPermission = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

        if (hasLocationPermission) {
            try {
                startForeground(1, createNotification())
            } catch (se: SecurityException) {
                Log.w("EmergencyService", "startForeground blocked by FGS permission: ${se.message}")
            }
            initLocationStreaming()
        } else {
            Log.w("EmergencyService", "No location permission; stopping service to avoid FGS enforcement")
            // We cannot request permissions from a Service — stop and let an Activity request them.
            stopSelf()
            return
        }

        // Acquire wake lock to keep CPU running during streaming
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HelpNet::StreamingWakeLock")
        wakeLock?.acquire(60 * 60 * 1000L) // 1 hour max
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        incidentType = intent?.getStringExtra("INCIDENT_TYPE")

        // Handle notification stop request: open PasswordActivity (via the service)
        if (intent?.action == ACTION_REQUEST_STOP) {
            val pwdIntent = Intent(this, PasswordActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(pwdIntent)
            return START_STICKY
        }

        // Handle forced stop (after correct PIN) - stop service immediately
        if (intent?.action == ACTION_FORCE_STOP) {
            Log.i("EmergencyService", "Received FORCE STOP - stopping service")
            stopForeground(true)
            stopSelf()
            return START_NOT_STICKY
        }

        when (intent?.action) {
            "ACTION_START_RECORDING" -> startCameraAndRecording()
            "ACTION_STOP_RECORDING" -> stopCameraRecordingAndUpload()
            ACTION_START_STREAMING -> {
                incidentId = intent.getStringExtra("INCIDENT_ID")
                startStreamingToBackend()
            }
        }

        return START_STICKY
    }

    private fun initLocationStreaming() {
        try {
            fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

            val locationRequest = LocationRequest.create().apply {
                interval = 5000L
                fastestInterval = 5000L
                priority = LocationRequest.PRIORITY_HIGH_ACCURACY
            }

            locationCallback = object : LocationCallback() {
                override fun onLocationResult(locationResult: LocationResult) {
                    locationResult.lastLocation?.let { location ->
                        sendLocationToBackend(location)
                    }
                }
            }

            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
        } catch (e: SecurityException) {
            Log.e("EmergencyService", "Missing location permission: ${e.message}")
        } catch (e: Exception) {
            Log.e("EmergencyService", "Failed to init location streaming: ${e.message}")
        }
    }

    private fun stopLocationStreaming() {
        if (::fusedLocationClient.isInitialized && ::locationCallback.isInitialized) {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        }
    }

    private fun sendLocationToBackend(location: Location) {
        val payload = mutableMapOf<String, Any>(
            "latitude" to location.latitude,
            "longitude" to location.longitude,
            "source" to "android_service"
        )
        incidentType?.let { payload["incident_type"] = it }

        ApiClient.service.postLive(payload).enqueue(object : Callback<okhttp3.ResponseBody> {
            override fun onResponse(call: Call<okhttp3.ResponseBody>, response: Response<okhttp3.ResponseBody>) {
                if (!response.isSuccessful) {
                    Log.w("EmergencyService", "Live post responded: ${response.code()}")
                }
            }

            override fun onFailure(call: Call<okhttp3.ResponseBody>, t: Throwable) {
                Log.e("EmergencyService", "Failed to post live location: ${t.message}")
            }
        })
    }

    // ---------------- CameraX recording ----------------
    private var cameraExecutor: ExecutorService? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var currentRecording: Recording? = null

    private fun startCameraAndRecording() {
        try {
            if (cameraExecutor == null) {
                cameraExecutor = Executors.newSingleThreadExecutor()
            }
            val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
            cameraProviderFuture.addListener({
                try {
                    val cameraProvider = cameraProviderFuture.get()
                    cameraProviderRef = cameraProvider

                    // Set up ImageAnalysis for frame streaming
                    imageAnalysis = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                    imageAnalysis?.setAnalyzer(cameraExecutor!!) { image ->
                        latestFrameBytes = imageProxyToJpeg(image)
                        image.close()
                    }

                    // Try preferred qualities with fallbacks for devices/emulators that don't support FHD
                    val preferred = listOf(Quality.FHD, Quality.HD, Quality.SD)
                    var bound = false
                    val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

                    for (q in preferred) {
                        try {
                            val recorder = Recorder.Builder()
                                .setQualitySelector(QualitySelector.from(q))
                                .build()
                            videoCapture = VideoCapture.withOutput(recorder)

                            cameraProvider.unbindAll()
                            cameraProvider.bindToLifecycle(this, cameraSelector, videoCapture, imageAnalysis)
                            Log.d("EmergencyService", "Bound camera with quality=$q + ImageAnalysis")
                            bound = true
                            break
                        } catch (qe: Exception) {
                            Log.w("EmergencyService", "Quality $q not supported, trying next: ${qe.message}")
                        }
                    }

                    if (!bound) {
                        // Try without ImageAnalysis as fallback
                        for (q in preferred) {
                            try {
                                val recorder = Recorder.Builder()
                                    .setQualitySelector(QualitySelector.from(q))
                                    .build()
                                videoCapture = VideoCapture.withOutput(recorder)
                                cameraProvider.unbindAll()
                                cameraProvider.bindToLifecycle(this, cameraSelector, videoCapture)
                                Log.d("EmergencyService", "Bound camera with quality=$q (no ImageAnalysis)")
                                bound = true
                                break
                            } catch (qe: Exception) { }
                        }
                    }

                    if (!bound) {
                        throw Exception("Unable to bind camera with any supported quality")
                    }

                    // Start frame upload if incident ID is available
                    if (incidentId != null && frameTask == null) {
                        startFrameUpload()
                    }

                    // prepare file
                    val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", java.util.Locale.getDefault()).format(Date())
                    val outDir = getExternalFilesDir(Environment.DIRECTORY_MOVIES)
                    outDir?.mkdirs()
                    val outFile = java.io.File(outDir, "EMERGENCY_${timeStamp}.mp4")

                    val outputOptions = FileOutputOptions.Builder(outFile).build()
                    val pendingRecording: PendingRecording = videoCapture!!.output.prepareRecording(this, outputOptions)
                        .apply { if (hasAudioPermission()) withAudioEnabled() }

                    currentRecording = pendingRecording.start(ContextCompat.getMainExecutor(this)) { recordEvent ->
                        when (recordEvent) {
                            is VideoRecordEvent.Start -> {
                                // notify UI that recording started
                                sendRecordingBroadcast(true)
                            }
                            is VideoRecordEvent.Finalize -> {
                                // recording finished
                                sendRecordingBroadcast(false)
                            }
                            else -> {
                                // other events ignored for now
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.e("EmergencyService", "CameraX start failed: ${e.message}")
                }
            }, ContextCompat.getMainExecutor(this))
        } catch (e: Exception) {
            Log.e("EmergencyService", "startCameraAndRecording error: ${e.message}")
        }
    }

    private fun stopCameraRecordingAndUpload() {
        try {
            val recording = currentRecording
            currentRecording = null
            recording?.stop()

            // The FileOutputOptions used earlier created a file in getExternalFilesDir; find the latest file
            val outDir = getExternalFilesDir(Environment.DIRECTORY_MOVIES)
            val files = outDir?.listFiles()?.filter { it.name.startsWith("EMERGENCY_") }?.sortedByDescending { it.lastModified() }
            val file = files?.firstOrNull()
            if (file != null) {
                // Enqueue WorkManager job for reliable upload
                val data = androidx.work.Data.Builder()
                    .putString("file_path", file.absolutePath)
                    .putString("incident_type", incidentType)
                    .build()

                val request = androidx.work.OneTimeWorkRequestBuilder<com.example.helpnet.upload.UploadWorker>()
                    .setInputData(data)
                    .build()

                androidx.work.WorkManager.getInstance(this).enqueue(request)
            }
        } catch (e: Exception) {
            Log.e("EmergencyService", "stopCameraRecordingAndUpload error: ${e.message}")
        } finally {
            cameraExecutor?.shutdown()
            cameraExecutor = null
        }
    }

    private fun hasAudioPermission(): Boolean {
        return checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    private fun sendRecordingBroadcast(isRecording: Boolean) {
        val intent = Intent("com.example.helpnet.RECORDING_STATE")
        intent.putExtra("isRecording", isRecording)
        sendBroadcast(intent)
    }


    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "emergency_service_channel",
                "Emergency Service",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Keeps emergency functions running"
            }

            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        // Pending intent to request stop (opens PasswordActivity via the service)
        val stopIntent = Intent(this, EmergencyService::class.java).apply { action = ACTION_REQUEST_STOP }
        val stopPending = PendingIntent.getService(
            this,
            REQUEST_CODE_STOP,
            stopIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_IMMUTABLE else 0
        )

        val builder = NotificationCompat.Builder(this, "emergency_service_channel")
            .setContentTitle("Emergency Service Active")
            .setContentText("Helping in emergency situation")
            .setSmallIcon(R.drawable.ic_notification)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .addAction(android.R.drawable.ic_lock_power_off, "Stop", stopPending)

        val notification = builder.build()
        notification.flags = notification.flags or Notification.FLAG_NO_CLEAR
        return notification
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // Restart service shortly after being removed from Recents
        val restartIntent = Intent(applicationContext, EmergencyService::class.java)
        restartIntent.putExtra("INCIDENT_TYPE", incidentType)
        val pending = PendingIntent.getService(
            applicationContext,
            0,
            restartIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_IMMUTABLE else 0
        )
        val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerAt = System.currentTimeMillis() + 1000L
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pending)
        }
        super.onTaskRemoved(rootIntent)
    }

    // ---------------- Frame streaming to backend ----------------

    private fun startStreamingToBackend() {
        val id = incidentId ?: return
        if (frameTask != null) return

        // If camera is not running yet, start it with ImageAnalysis only
        if (cameraProviderRef == null) {
            startCameraForStreamingOnly()
        } else {
            // Camera already running (from recording) — just start upload
            startFrameUpload()
        }
    }

    private fun startCameraForStreamingOnly() {
        try {
            if (cameraExecutor == null) {
                cameraExecutor = Executors.newSingleThreadExecutor()
            }
            val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
            cameraProviderFuture.addListener({
                try {
                    val cameraProvider = cameraProviderFuture.get()
                    cameraProviderRef = cameraProvider
                    cameraProvider.unbindAll()

                    val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
                    imageAnalysis = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                    imageAnalysis?.setAnalyzer(cameraExecutor!!) { image ->
                        latestFrameBytes = imageProxyToJpeg(image)
                        image.close()
                    }

                    cameraProvider.bindToLifecycle(this, cameraSelector, imageAnalysis!!)
                    Log.d("EmergencyService", "Camera started for streaming only")
                    startFrameUpload()
                } catch (e: Exception) {
                    Log.e("EmergencyService", "Camera start for streaming failed: ${e.message}")
                }
            }, ContextCompat.getMainExecutor(this))
        } catch (e: Exception) {
            Log.e("EmergencyService", "startCameraForStreamingOnly error: ${e.message}")
        }
    }

    private fun startFrameUpload() {
        val id = incidentId ?: return
        if (frameTask != null) return

        frameScheduler = Executors.newSingleThreadScheduledExecutor()
        frameTask = frameScheduler?.scheduleWithFixedDelay({
            try {
                val bytes = latestFrameBytes ?: return@scheduleWithFixedDelay
                val body = bytes.toRequestBody("image/jpeg".toMediaTypeOrNull())
                val part = MultipartBody.Part.createFormData("frame", "frame.jpg", body)
                ApiClient.service.uploadFrame(id, part).execute()
            } catch (e: Exception) {
                Log.w("EmergencyService", "Frame upload failed: ${e.message}")
            }
        }, 0, 150, TimeUnit.MILLISECONDS)
        Log.d("EmergencyService", "Frame upload started for incident $id")

        // Start audio streaming alongside video frames
        startAudioStreaming(id)
    }

    private fun imageProxyToJpeg(image: ImageProxy): ByteArray? {
        try {
            val width = image.width
            val height = image.height
            val yPlane = image.planes[0]
            val uPlane = image.planes[1]
            val vPlane = image.planes[2]
            val yRowStride = yPlane.rowStride
            val uvRowStride = vPlane.rowStride
            val uvPixelStride = vPlane.pixelStride
            val nv21 = ByteArray(width * height * 3 / 2)
            var pos = 0
            val yBuffer = yPlane.buffer
            val uBuffer = uPlane.buffer
            val vBuffer = vPlane.buffer
            for (row in 0 until height) {
                yBuffer.position(row * yRowStride)
                yBuffer.get(nv21, pos, width)
                pos += width
            }
            for (row in 0 until height / 2) {
                for (col in 0 until width / 2) {
                    nv21[pos++] = vBuffer.get(row * uvRowStride + col * uvPixelStride)
                    nv21[pos++] = uBuffer.get(row * uvRowStride + col * uvPixelStride)
                }
            }
            val yuvImage = YuvImage(nv21, ImageFormat.NV21, width, height, null)
            val out = ByteArrayOutputStream()
            yuvImage.compressToJpeg(Rect(0, 0, width, height), 70, out)
            return out.toByteArray()
        } catch (e: Exception) {
            return null
        }
    }

    private fun stopFrameStreaming() {
        frameTask?.cancel(true)
        frameTask = null
        frameScheduler?.shutdownNow()
        frameScheduler = null
        latestFrameBytes = null
        stopAudioStreaming()
    }

    // ---------------- Audio streaming to backend ----------------

    private fun startAudioStreaming(incidentId: String) {
        if (isAudioStreaming) return
        if (!hasAudioPermission()) {
            Log.w("EmergencyService", "No RECORD_AUDIO permission, skipping audio")
            return
        }

        val sampleRate = 16000
        val channelConfig = AudioFormat.CHANNEL_IN_MONO
        val audioFormat = AudioFormat.ENCODING_PCM_16BIT
        val minBufSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
        if (minBufSize == AudioRecord.ERROR || minBufSize == AudioRecord.ERROR_BAD_VALUE) {
            Log.e("EmergencyService", "AudioRecord.getMinBufferSize failed")
            return
        }
        // Use a buffer large enough for ~1 second of audio
        val bufferSize = maxOf(minBufSize, sampleRate * 2) // 16-bit mono = 2 bytes/sample

        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                sampleRate,
                channelConfig,
                audioFormat,
                bufferSize
            )
        } catch (e: SecurityException) {
            Log.e("EmergencyService", "AudioRecord SecurityException: ${e.message}")
            return
        }

        if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
            Log.e("EmergencyService", "AudioRecord failed to initialize")
            audioRecord?.release()
            audioRecord = null
            return
        }

        isAudioStreaming = true
        audioRecord?.startRecording()

        audioThread = Thread({
            val readBuf = ByteArray(sampleRate * 2) // ~1 second of 16kHz mono 16-bit
            while (isAudioStreaming) {
                try {
                    val bytesRead = audioRecord?.read(readBuf, 0, readBuf.size) ?: -1
                    if (bytesRead > 0) {
                        val chunk = readBuf.copyOf(bytesRead)
                        val body = chunk.toRequestBody("application/octet-stream".toMediaTypeOrNull())
                        val part = MultipartBody.Part.createFormData("audio", "audio.pcm", body)
                        ApiClient.service.uploadAudio(incidentId, part).execute()
                    }
                } catch (e: Exception) {
                    Log.w("EmergencyService", "Audio upload failed: ${e.message}")
                }
            }
        }, "AudioStreamThread")
        audioThread?.start()
        Log.d("EmergencyService", "Audio streaming started for incident $incidentId")
    }

    private fun stopAudioStreaming() {
        isAudioStreaming = false
        try {
            audioRecord?.stop()
        } catch (_: Exception) {}
        audioRecord?.release()
        audioRecord = null
        audioThread?.interrupt()
        audioThread = null
    }

    override fun onDestroy() {
        super.onDestroy()
        stopFrameStreaming()
        stopLocationStreaming()
        currentRecording?.stop()
        currentRecording = null
        try { cameraProviderRef?.unbindAll() } catch (_: Exception) {}
        try { wakeLock?.release() } catch (_: Exception) {}
        cameraExecutor?.shutdown()
        cameraExecutor = null
    }

    companion object {
        private const val REQUEST_CODE_STOP = 2001
        const val ACTION_REQUEST_STOP = "com.example.helpnet.ACTION_REQUEST_STOP"
        const val ACTION_FORCE_STOP = "com.example.helpnet.ACTION_FORCE_STOP"
        const val ACTION_START_STREAMING = "com.example.helpnet.ACTION_START_STREAMING"
        fun startService(context: Context, incidentType: String? = null) {
            val intent = Intent(context, EmergencyService::class.java).apply {
                if (incidentType != null) putExtra("INCIDENT_TYPE", incidentType)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun startRecording(context: Context) {
            val intent = Intent(context, EmergencyService::class.java).apply { action = "ACTION_START_RECORDING" }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopRecording(context: Context) {
            val intent = Intent(context, EmergencyService::class.java).apply { action = "ACTION_STOP_RECORDING" }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun startStreaming(context: Context, incidentId: String) {
            val intent = Intent(context, EmergencyService::class.java).apply {
                action = ACTION_START_STREAMING
                putExtra("INCIDENT_ID", incidentId)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, EmergencyService::class.java)
            context.stopService(intent)
        }
    }
}
