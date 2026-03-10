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

class RegisterActivity : AppCompatActivity() {

    private lateinit var etRegUsername: TextInputEditText
    private lateinit var etRegEmail: TextInputEditText
    private lateinit var etRegPassword: TextInputEditText
    private lateinit var etConfirmPassword: TextInputEditText
    private lateinit var btnRegister: MaterialButton
    private lateinit var tvLoginPrompt: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register)

        etRegUsername = findViewById(R.id.etRegUsername)
        etRegEmail = findViewById(R.id.etRegEmail)
        etRegPassword = findViewById(R.id.etRegPassword)
        etConfirmPassword = findViewById(R.id.etConfirmPassword)
        btnRegister = findViewById(R.id.btnRegister)
        tvLoginPrompt = findViewById(R.id.tvLoginPrompt)

        btnRegister.setOnClickListener {
            val username = etRegUsername.text.toString().trim()
            val email = etRegEmail.text.toString().trim()
            val password = etRegPassword.text.toString().trim()
            val confirmPassword = etConfirmPassword.text.toString().trim()

            if (username.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Please fill required fields", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (password != confirmPassword) {
                Toast.makeText(this, "Passwords do not match", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            btnRegister.isEnabled = false
            btnRegister.text = "Registering..."

            val request = AuthRequest(
                username = username,
                email = email.ifEmpty { null },
                password = password
            )
            
            ApiClient.service.register(request).enqueue(object : Callback<AuthResponse> {
                override fun onResponse(call: Call<AuthResponse>, response: Response<AuthResponse>) {
                    btnRegister.isEnabled = true
                    btnRegister.text = "Register"
                    
                    if (response.isSuccessful && response.body() != null) {
                        val token = response.body()?.token
                        if (token != null) {
                            saveTokenAndNavigate(token)
                        } else {
                            Toast.makeText(this@RegisterActivity, "Invalid token received", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Toast.makeText(this@RegisterActivity, "Registration failed: ${response.message()}", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<AuthResponse>, t: Throwable) {
                    btnRegister.isEnabled = true
                    btnRegister.text = "Register"
                    Toast.makeText(this@RegisterActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
        }

        tvLoginPrompt.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    private fun saveTokenAndNavigate(token: String) {
        val prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        prefs.edit().putString("ANDROID_AUTH_TOKEN", token).apply()
        ApiClient.authToken = token
        
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
