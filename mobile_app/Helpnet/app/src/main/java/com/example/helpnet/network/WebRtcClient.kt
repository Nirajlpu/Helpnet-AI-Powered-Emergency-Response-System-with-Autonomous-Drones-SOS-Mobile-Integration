package com.example.helpnet.network

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.util.Log
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import org.webrtc.*
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

class WebRtcClient(
    private val context: Context,
    private val rootEglBase: EglBase,
    private val incidentId: String
) {

    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var videoCapturer: VideoCapturer? = null
    private var localVideoSource: VideoSource? = null
    private var localVideoTrack: VideoTrack? = null
    private var webSocket: WebSocket? = null

    // Frame streaming fallback
    private val frameScheduler = Executors.newSingleThreadScheduledExecutor()
    private var frameTask: ScheduledFuture<*>? = null
    private var latestBitmap: Bitmap? = null
    private val bitmapLock = Object()

    init {
        initWebRTC()
        connectWebSocket()
    }

    private fun initWebRTC() {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context)
                .setEnableInternalTracer(true)
                .createInitializationOptions()
        )

        val options = PeerConnectionFactory.Options()
        val defaultVideoEncoderFactory = DefaultVideoEncoderFactory(rootEglBase.eglBaseContext, true, true)
        val defaultVideoDecoderFactory = DefaultVideoDecoderFactory(rootEglBase.eglBaseContext)

        peerConnectionFactory = PeerConnectionFactory.builder()
            .setOptions(options)
            .setVideoEncoderFactory(defaultVideoEncoderFactory)
            .setVideoDecoderFactory(defaultVideoDecoderFactory)
            .createPeerConnectionFactory()

        createPeerConnection()
    }

    private fun createPeerConnection() {
        val iceServers = listOf(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer())
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers)
        rtcConfig.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN

        peerConnection = peerConnectionFactory?.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onSignalingChange(p0: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(p0: PeerConnection.IceConnectionState?) {}
            override fun onIceConnectionReceivingChange(p0: Boolean) {}
            override fun onIceGatheringChange(p0: PeerConnection.IceGatheringState?) {}
            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate?.let {
                    val json = JSONObject()
                    json.put("type", "icecandidate")
                    val candJson = JSONObject()
                    candJson.put("sdpMLineIndex", it.sdpMLineIndex)
                    candJson.put("sdpMid", it.sdpMid)
                    candJson.put("candidate", it.sdp)
                    json.put("candidate", candJson)
                    webSocket?.send(json.toString())
                }
            }
            override fun onIceCandidatesRemoved(p0: Array<out IceCandidate>?) {}
            override fun onAddStream(p0: MediaStream?) {}
            override fun onRemoveStream(p0: MediaStream?) {}
            override fun onDataChannel(p0: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(p0: RtpReceiver?, p1: Array<out MediaStream>?) {}
        })
    }

    fun startLocalVideoCapture() {
        videoCapturer = createVideoCapturer()
        val surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThread", rootEglBase.eglBaseContext)
        localVideoSource = peerConnectionFactory?.createVideoSource(videoCapturer!!.isScreencast)
        videoCapturer?.initialize(surfaceTextureHelper, context, localVideoSource?.capturerObserver)
        videoCapturer?.startCapture(640, 480, 30)

        localVideoTrack = peerConnectionFactory?.createVideoTrack("100", localVideoSource)
        peerConnection?.addTrack(localVideoTrack, listOf("stream"))

        // Add a video sink to capture frames for HTTP fallback streaming
        localVideoTrack?.addSink { videoFrame ->
            try {
                val buffer = videoFrame.buffer
                val i420 = buffer.toI420() ?: return@addSink
                val width = i420.width
                val height = i420.height
                val nv21Size = width * height * 3 / 2
                val nv21Buffer = java.nio.ByteBuffer.allocateDirect(nv21Size)
                YuvHelper.I420ToNV12(
                    i420.dataY, i420.strideY,
                    i420.dataV, i420.strideV,
                    i420.dataU, i420.strideU,
                    nv21Buffer, width, height
                )
                i420.release()
                val nv21Bytes = ByteArray(nv21Size)
                nv21Buffer.position(0)
                nv21Buffer.get(nv21Bytes)
                val yuvImage = android.graphics.YuvImage(
                    nv21Bytes, android.graphics.ImageFormat.NV21, width, height, null
                )
                val out = ByteArrayOutputStream()
                yuvImage.compressToJpeg(android.graphics.Rect(0, 0, width, height), 50, out)
                val jpegBytes = out.toByteArray()
                val bmp = android.graphics.BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)
                synchronized(bitmapLock) {
                    latestBitmap?.recycle()
                    latestBitmap = bmp
                }
            } catch (_: Exception) {}
        }

        // Start uploading frames to the backend at ~5 fps
        startFrameStreaming()

        createOffer()
    }

    private fun startFrameStreaming() {
        frameTask = frameScheduler.scheduleWithFixedDelay({
            try {
                val bmp: Bitmap?
                synchronized(bitmapLock) {
                    bmp = latestBitmap
                }
                if (bmp != null && !bmp.isRecycled) {
                    val out = ByteArrayOutputStream()
                    bmp.compress(Bitmap.CompressFormat.JPEG, 50, out)
                    val jpegBytes = out.toByteArray()
                    val body = jpegBytes.toRequestBody("image/jpeg".toMediaTypeOrNull())
                    val part = MultipartBody.Part.createFormData("frame", "frame.jpg", body)
                    ApiClient.service.uploadFrame(incidentId, part).execute()
                }
            } catch (e: Exception) {
                Log.w("WebRtcClient", "Frame upload failed: ${e.message}")
            }
        }, 0, 200, TimeUnit.MILLISECONDS)
    }

    private fun createOffer() {
        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(desc: SessionDescription?) {
                peerConnection?.setLocalDescription(object : SdpObserver {
                    override fun onCreateSuccess(p0: SessionDescription?) {}
                    override fun onSetSuccess() {}
                    override fun onCreateFailure(p0: String?) {}
                    override fun onSetFailure(p0: String?) {}
                }, desc)

                val json = JSONObject()
                json.put("type", "offer")
                val offerJson = JSONObject()
                offerJson.put("type", "offer")
                offerJson.put("sdp", desc?.description)
                json.put("offer", offerJson)
                webSocket?.send(json.toString())
            }
            override fun onSetSuccess() {}
            override fun onCreateFailure(p0: String?) {}
            override fun onSetFailure(p0: String?) {}
        }, MediaConstraints())
    }

    private fun createVideoCapturer(): VideoCapturer? {
        val enumerator = Camera2Enumerator(context)
        val deviceNames = enumerator.deviceNames
        for (deviceName in deviceNames) {
            // Prefer back facing camera for emergencies, fallback to front
            if (enumerator.isBackFacing(deviceName)) {
                return enumerator.createCapturer(deviceName, null)
            }
        }
        for (deviceName in deviceNames) {
            if (enumerator.isFrontFacing(deviceName)) {
                return enumerator.createCapturer(deviceName, null)
            }
        }
        return null
    }

    private fun connectWebSocket() {
        val client = OkHttpClient.Builder().readTimeout(0, TimeUnit.MILLISECONDS).build()
        // Determine host dynamically from ApiClient
        val host = ApiClient.BASE_URL.replace("http://", "").replace("https://", "").removeSuffix("/")
        val wsUrl = "ws://$host/ws/video/$incidentId/"
        val request = Request.Builder().url(wsUrl).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    if (json.has("type") && json.getString("type") == "answer") {
                        val answerJson = json.getJSONObject("answer")
                        val sdp = SessionDescription(SessionDescription.Type.ANSWER, answerJson.getString("sdp"))
                        peerConnection?.setRemoteDescription(object : SdpObserver {
                            override fun onCreateSuccess(p0: SessionDescription?) {}
                            override fun onSetSuccess() {}
                            override fun onCreateFailure(p0: String?) {}
                            override fun onSetFailure(p0: String?) {}
                        }, sdp)
                    } else if (json.has("type") && json.getString("type") == "icecandidate") {
                        val candJson = json.getJSONObject("candidate")
                        val candidate = IceCandidate(
                            candJson.getString("sdpMid"),
                            candJson.getInt("sdpMLineIndex"),
                            candJson.getString("candidate")
                        )
                        peerConnection?.addIceCandidate(candidate)
                    } else if (json.has("type") && json.getString("type") == "viewer-joined") {
                        // A new viewer connected — re-create peer connection and send a fresh offer
                        Log.d("WebRtcClient", "Viewer joined, re-sending offer")
                        createPeerConnection()
                        localVideoTrack?.let { peerConnection?.addTrack(it, listOf("stream")) }
                        createOffer()
                    }
                } catch (e: Exception) {
                    Log.e("WebRtcClient", "Error parsing WebSocket message", e)
                }
            }
        })
    }

    fun onDestroy() {
        frameTask?.cancel(true)
        frameScheduler.shutdownNow()
        synchronized(bitmapLock) {
            latestBitmap?.recycle()
            latestBitmap = null
        }
        try { videoCapturer?.stopCapture() } catch(e: Exception) {}
        videoCapturer?.dispose()
        localVideoSource?.dispose()
        peerConnection?.close()
        peerConnectionFactory?.dispose()
        webSocket?.close(1000, "Goodbye")
    }
}
