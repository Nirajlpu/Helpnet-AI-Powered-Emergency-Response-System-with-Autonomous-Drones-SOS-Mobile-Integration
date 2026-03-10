package com.example.helpnet.network
import com.example.helpnet.R

import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path

interface ApiService {
    @POST("api/sos/")
    fun postSos(@Body body: Map<String, @JvmSuppressWildcards Any>): Call<ResponseBody>

    @POST("api/incidents/live/")
    fun postLive(@Body body: Map<String, @JvmSuppressWildcards Any>): Call<ResponseBody>

    @POST("api/auth/token/")
    fun login(@Body request: com.example.helpnet.data.model.AuthRequest): Call<com.example.helpnet.data.model.AuthResponse>

    @POST("api/auth/register/")
    fun register(@Body request: com.example.helpnet.data.model.AuthRequest): Call<com.example.helpnet.data.model.AuthResponse>

    @Multipart
    @POST("api/incidents/upload_video/")
    fun uploadVideo(@Part file: MultipartBody.Part, @Part("metadata") metadata: RequestBody): Call<ResponseBody>

    @Multipart
    @POST("api/incidents/{id}/stream-frame/")
    fun uploadFrame(@Path("id") incidentId: String, @Part frame: MultipartBody.Part): Call<ResponseBody>

    @Multipart
    @POST("api/incidents/{id}/stream-audio/")
    fun uploadAudio(@Path("id") incidentId: String, @Part audio: MultipartBody.Part): Call<ResponseBody>
}
