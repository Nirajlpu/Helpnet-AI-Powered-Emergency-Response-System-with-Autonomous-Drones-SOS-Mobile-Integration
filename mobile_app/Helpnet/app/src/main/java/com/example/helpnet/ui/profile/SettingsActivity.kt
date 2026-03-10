package com.example.helpnet.ui.profile
import com.example.helpnet.R

import android.content.Context
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.helpnet.network.ApiClient

class SettingsActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val editToken = findViewById<EditText>(R.id.editToken)
        val saveButton = findViewById<Button>(R.id.saveTokenButton)

        // Load existing token
        val prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        val existing = prefs.getString("ANDROID_AUTH_TOKEN", "")
        editToken.setText(existing)

        saveButton.setOnClickListener {
            val token = editToken.text.toString().trim()
            prefs.edit().putString("ANDROID_AUTH_TOKEN", token).apply()
            // Update ApiClient so the app uses the token immediately
            ApiClient.authToken = token
            Toast.makeText(this, "Auth token saved", Toast.LENGTH_SHORT).show()
            finish()
        }
    }
}
