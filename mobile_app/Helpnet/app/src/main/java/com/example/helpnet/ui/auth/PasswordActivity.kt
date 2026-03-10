package com.example.helpnet.ui.auth
import com.example.helpnet.R

import com.example.helpnet.service.EmergencyService
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

class PasswordActivity : AppCompatActivity() {
    private val PIN = "123321"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val input = EditText(this)
        input.hint = "Enter PIN"
        input.inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD

        AlertDialog.Builder(this)
            .setTitle("Confirm Stop")
            .setMessage("Enter PIN to stop emergency service")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("OK") { _, _ ->
                val entered = input.text.toString()
                if (entered == PIN) {
                    val stopIntent = Intent(this, EmergencyService::class.java).apply { action = EmergencyService.ACTION_FORCE_STOP }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(stopIntent)

                    } else {
                        startService(stopIntent)
                    }
                    finish()
                } else {
                    Toast.makeText(this, "Incorrect PIN", Toast.LENGTH_SHORT).show()
                    finish()
                }
            }
            .setNegativeButton("Cancel") { _, _ -> finish() }
            .show()
    }
}
