package com.example.helpnet

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.helpnet.R
import com.google.android.material.textfield.TextInputEditText

class ProfileActivity : AppCompatActivity() {

    private lateinit var nameEditText: TextInputEditText
    private lateinit var ageEditText: TextInputEditText
    private lateinit var bloodGroupEditText: TextInputEditText
    private lateinit var allergiesEditText: TextInputEditText
    private lateinit var medicationsEditText: TextInputEditText
    private lateinit var medicalConditionsEditText: TextInputEditText
    private lateinit var emergencyInfoEditText: TextInputEditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_profile)

        // Initialize UI elements
        nameEditText = findViewById(R.id.editTextName)
        ageEditText = findViewById(R.id.editTextAge)
        bloodGroupEditText = findViewById(R.id.editTextBloodGroup)
        allergiesEditText = findViewById(R.id.editTextAllergies)
        medicationsEditText = findViewById(R.id.editTextMedications)
        medicalConditionsEditText = findViewById(R.id.editTextMedicalConditions)
        emergencyInfoEditText = findViewById(R.id.editTextEmergencyInfo)

        val saveButton = findViewById<Button>(R.id.btnSaveProfile)

        // Load saved profile data
        loadProfileData()

        // Set up save button
        saveButton.setOnClickListener {
            saveProfileData()
        }
    }

    private fun loadProfileData() {
        // Load from SharedPreferences
        val sharedPreferences = getSharedPreferences("UserProfile", MODE_PRIVATE)

        nameEditText.setText(sharedPreferences.getString("name", ""))
        ageEditText.setText(sharedPreferences.getString("age", ""))
        bloodGroupEditText.setText(sharedPreferences.getString("bloodGroup", ""))
        allergiesEditText.setText(sharedPreferences.getString("allergies", ""))
        medicationsEditText.setText(sharedPreferences.getString("medications", ""))
        medicalConditionsEditText.setText(sharedPreferences.getString("medicalConditions", ""))
        emergencyInfoEditText.setText(sharedPreferences.getString("emergencyInfo", ""))
    }

    private fun saveProfileData() {
        // Save to SharedPreferences
        val sharedPreferences = getSharedPreferences("UserProfile", MODE_PRIVATE)
        val editor = sharedPreferences.edit()

        editor.putString("name", nameEditText.text.toString())
        editor.putString("age", ageEditText.text.toString())
        editor.putString("bloodGroup", bloodGroupEditText.text.toString())
        editor.putString("allergies", allergiesEditText.text.toString())
        editor.putString("medications", medicationsEditText.text.toString())
        editor.putString("medicalConditions", medicalConditionsEditText.text.toString())
        editor.putString("emergencyInfo", emergencyInfoEditText.text.toString())

        editor.apply()

        Toast.makeText(this, "Profile saved successfully", Toast.LENGTH_SHORT).show()
    }
}