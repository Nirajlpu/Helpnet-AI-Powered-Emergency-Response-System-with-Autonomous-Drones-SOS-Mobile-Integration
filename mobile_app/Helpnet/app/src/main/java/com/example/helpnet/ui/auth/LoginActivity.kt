package com.example.helpnet.ui.auth

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.helpnet.R
import com.example.helpnet.data.model.AuthRequest
import com.example.helpnet.data.model.AuthResponse
import com.example.helpnet.network.ApiClient
import com.example.helpnet.ui.main.MainActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class LoginActivity : AppCompatActivity() {

    private lateinit var etUsername: TextInputEditText
    private lateinit var etPassword: TextInputEditText
    private lateinit var btnLogin: MaterialButton
    private lateinit var tvRegisterPrompt: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Check if already logged in
        val prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        val savedToken = prefs.getString("ANDROID_AUTH_TOKEN", "")
        if (!savedToken.isNullOrEmpty()) {
            ApiClient.authToken = savedToken
            navigateToMain()
            return
        }
        
        setContentView(R.layout.activity_login)

        etUsername = findViewById(R.id.etUsername)
        etPassword = findViewById(R.id.etPassword)
        btnLogin = findViewById(R.id.btnLogin)
        tvRegisterPrompt = findViewById(R.id.tvRegisterPrompt)

        btnLogin.setOnClickListener {
            val username = etUsername.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (username.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Please enter username and password", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            btnLogin.isEnabled = false
            btnLogin.text = "Logging in..."

            val request = AuthRequest(username = username, password = password)
            ApiClient.service.login(request).enqueue(object : Callback<AuthResponse> {
                override fun onResponse(call: Call<AuthResponse>, response: Response<AuthResponse>) {
                    btnLogin.isEnabled = true
                    btnLogin.text = "Login"
                    
                    if (response.isSuccessful && response.body() != null) {
                        val token = response.body()?.token
                        if (token != null) {
                            saveTokenAndNavigate(token)
                        } else {
                            Toast.makeText(this@LoginActivity, "Invalid token received", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Toast.makeText(this@LoginActivity, "Login failed: ${response.message()}", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<AuthResponse>, t: Throwable) {
                    btnLogin.isEnabled = true
                    btnLogin.text = "Login"
                    Toast.makeText(this@LoginActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
        }

        tvRegisterPrompt.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
            finish()
        }
    }

    private fun saveTokenAndNavigate(token: String) {
        val prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        prefs.edit().putString("ANDROID_AUTH_TOKEN", token).apply()
        ApiClient.authToken = token
        navigateToMain()
    }

    private fun navigateToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
