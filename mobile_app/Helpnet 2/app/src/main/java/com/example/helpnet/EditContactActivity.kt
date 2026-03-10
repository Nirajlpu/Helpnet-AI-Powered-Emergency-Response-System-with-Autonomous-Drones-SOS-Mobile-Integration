package com.example.helpnet

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import com.example.helpnet.R

class EditContactActivity : AppCompatActivity() {

    private lateinit var etName: EditText
    private lateinit var etPhone: EditText
    private lateinit var contact: EmergencyContactsActivity.EmergencyContact

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_edit_contact)

        contact = intent.getSerializableExtra("contact") as EmergencyContactsActivity.EmergencyContact

        etName = findViewById(R.id.etName)
        etPhone = findViewById(R.id.etPhone)

        etName.setText(contact.name)
        etPhone.setText(contact.phoneNumber)

        val btnSave = findViewById<Button>(R.id.btnSave)
        btnSave.setOnClickListener {
            saveChanges()
        }

        val btnCancel = findViewById<Button>(R.id.btnCancel)
        btnCancel.setOnClickListener {
            finish()
        }
    }

    private fun saveChanges() {
        val newName = etName.text.toString().trim()
        val newPhone = etPhone.text.toString().trim()

        if (newName.isEmpty() || newPhone.isEmpty()) {
            showError("Please enter both name and phone number")
            return
        }

        val updatedContact = contact.copy(name = newName, phoneNumber = newPhone)
        val resultIntent = Intent().apply {
            putExtra("updated_contact", updatedContact)
        }
        setResult(RESULT_OK, resultIntent)
        finish()
    }

    private fun showError(message: String) {
        etName.error = message
    }
}