package com.example.helpnet.upload
import com.example.helpnet.R

import android.content.Context
import android.util.Log
import androidx.work.Data
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.example.helpnet.network.ApiClient
import okhttp3.ResponseBody
import retrofit2.Response

class UploadWorker(appContext: Context, params: WorkerParameters) : Worker(appContext, params) {
    override fun doWork(): Result {
        val filePath = inputData.getString("file_path") ?: return Result.failure()
        val incidentType = inputData.getString("incident_type")

        try {
            val metadata = mutableMapOf<String, Any>("source" to "android_service")
            incidentType?.let { metadata["incident_type"] = it }

            var success = false
            val latch = java.util.concurrent.CountDownLatch(1)
            ApiClient.uploadVideoFile(filePath, metadata, object : retrofit2.Callback<ResponseBody> {
                override fun onResponse(call: retrofit2.Call<ResponseBody>, response: Response<ResponseBody>) {
                    success = response.isSuccessful
                    latch.countDown()
                }

                override fun onFailure(call: retrofit2.Call<ResponseBody>, t: Throwable) {
                    Log.e("UploadWorker", "Upload failed: ${t.message}")
                    success = false
                    latch.countDown()
                }
            })
            latch.await()

            return if (success) Result.success() else Result.retry()
        } catch (e: Exception) {
            Log.e("UploadWorker", "Exception uploading: ${e.message}")
            return Result.retry()
        }
    }
}
