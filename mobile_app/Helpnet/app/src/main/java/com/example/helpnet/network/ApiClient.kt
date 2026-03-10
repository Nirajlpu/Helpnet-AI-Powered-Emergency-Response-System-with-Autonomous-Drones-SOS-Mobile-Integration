package com.example.helpnet.network
import com.example.helpnet.R

import android.util.Log
import com.squareup.moshi.Moshi
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.io.IOException
import java.util.concurrent.TimeUnit

object ApiClient {
    // For emulator use 10.0.2.2, for LAN use Mac IP, for mobile data use ngrok URL
    const val BASE_URL = "https://newfangled-hayes-tensible.ngrok-free.dev/"

    private val retryInterceptor = Interceptor { chain ->
        var attempt = 0
        var lastException: IOException? = null
        while (attempt < 3) {
            try {
                return@Interceptor chain.proceed(chain.request())
            } catch (e: IOException) {
                lastException = e
                attempt++
                try {
                    Thread.sleep((attempt * 500).toLong())
                } catch (ie: InterruptedException) {
                    break
                }
            }
        }
        throw lastException ?: IOException("Unknown network error")
    }

    private val httpClient: OkHttpClient by lazy {
        val logging = HttpLoggingInterceptor { message -> Log.d("ApiClient", message) }
        logging.level = HttpLoggingInterceptor.Level.BASIC
        val builder = OkHttpClient.Builder()
            .addInterceptor(retryInterceptor)
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)

        // Authorization header interceptor (if token set)
        builder.addInterceptor { chain ->
            val req = chain.request()
            val token = authToken
            if (token.isNullOrEmpty()) return@addInterceptor chain.proceed(req)
            val newReq = req.newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
            chain.proceed(newReq)
        }

        builder.build()
    }

    private val moshi: Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(httpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
    }

    // Mutable token; set before making requests if your backend requires authentication.
    var authToken: String? = null

    val service: ApiService by lazy { retrofit.create(ApiService::class.java) }

    // Helper for uploading a file with metadata
    fun uploadVideoFile(filePath: String, metadata: Map<String, Any>, callback: retrofit2.Callback<okhttp3.ResponseBody>) {
        try {
            val file = java.io.File(filePath)
            val reqBody = file.asRequestBody("video/mp4".toMediaTypeOrNull())
            val part = okhttp3.MultipartBody.Part.createFormData("file", file.name, reqBody)

            val moshi = com.squareup.moshi.Moshi.Builder()
                .addLast(KotlinJsonAdapterFactory())
                .build()
            val jsonAdapter = moshi.adapter(Map::class.java)
            val metaJson = jsonAdapter.toJson(metadata)
            val metadataBody = metaJson.toRequestBody("application/json".toMediaTypeOrNull())

            service.uploadVideo(part, metadataBody).enqueue(callback)
        } catch (e: Exception) {
            android.util.Log.e("ApiClient", "uploadVideoFile error: ${e.message}")
        }
    }
}
