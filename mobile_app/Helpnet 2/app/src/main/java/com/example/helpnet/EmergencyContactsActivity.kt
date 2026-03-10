package com.example.helpnet

import android.Manifest
import android.app.AlertDialog
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.provider.ContactsContract
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.helpnet.R
import com.google.android.material.floatingactionbutton.FloatingActionButton
import kotlinx.parcelize.Parcelize
import android.os.Parcelable
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json

class EmergencyContactsActivity : AppCompatActivity() {

    private val CONTACTS_PERMISSION_REQUEST_CODE = 2001
    private val PICK_CONTACT_REQUEST_CODE = 2002
    private val EDIT_CONTACT_REQUEST_CODE = 2003

    private lateinit var recyclerView: RecyclerView
    private lateinit var adapter: EmergencyContactsAdapter
    private val emergencyContacts = mutableListOf<EmergencyContact>()
    private var editPosition: Int = -1

    companion object {
        const val PREFS_NAME = "EmergencyContactsPrefs"
        const val CONTACTS_KEY = "emergency_contacts"
    }

    @Parcelize
    @Serializable
    data class EmergencyContact(
        val name: String,
        val phoneNumber: String,
        var isDefault: Boolean = false
    ) : Parcelable {
        fun formattedPhoneNumber(): String {
            return phoneNumber.replace("[^0-9+]".toRegex(), "")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_emergency_contacts)

        setupRecyclerView()
        setupAddButton()
        setupBackButton()

        loadEmergencyContacts()
    }

    private fun setupRecyclerView() {
        recyclerView = findViewById(R.id.recyclerViewContacts)
        recyclerView.layoutManager = LinearLayoutManager(this)

        adapter = EmergencyContactsAdapter(emergencyContacts) { contact, position ->
            showContactOptions(contact, position)
        }

        recyclerView.adapter = adapter
    }

    private fun setupAddButton() {
        val addButton = findViewById<FloatingActionButton>(R.id.fabAddContact)
        addButton.setOnClickListener {
            showAddContactOptions()
        }
    }

    private fun setupBackButton() {
        val backButton = findViewById<Button>(R.id.btnBack)
        backButton.setOnClickListener {
            finish()
        }
    }

    private fun showAddContactOptions() {
        val options = arrayOf("Select from contacts", "Enter manually")
        AlertDialog.Builder(this)
            .setTitle("Add Emergency Contact")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> handleContactSelection()
                    1 -> showManualEntryDialog()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun handleContactSelection() {
        if (checkContactsPermission()) {
            pickContact()
        } else {
            requestContactsPermission()
        }
    }

    private fun checkContactsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.READ_CONTACTS
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestContactsPermission() {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.READ_CONTACTS),
            CONTACTS_PERMISSION_REQUEST_CODE
        )
    }

    private fun pickContact() {
        val intent = Intent(Intent.ACTION_PICK, ContactsContract.Contacts.CONTENT_URI)
        startActivityForResult(intent, PICK_CONTACT_REQUEST_CODE)
    }

    private fun showManualEntryDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_edit_contact, null)
        val etName = dialogView.findViewById<EditText>(R.id.etName)
        val etPhone = dialogView.findViewById<EditText>(R.id.etPhone)

        AlertDialog.Builder(this)
            .setTitle("Add New Contact")
            .setView(dialogView)
            .setPositiveButton("Save") { _, _ ->
                val name = etName.text.toString().trim()
                val phone = etPhone.text.toString().trim()

                if (name.isNotEmpty() && phone.isNotEmpty()) {
                    val contact = EmergencyContact(name, phone)
                    addEmergencyContact(contact)
                } else {
                    Toast.makeText(this, "Please enter both name and phone number", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode == CONTACTS_PERMISSION_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pickContact()
            } else {
                Toast.makeText(this, "Permission denied - cannot access contacts", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        when (requestCode) {
            PICK_CONTACT_REQUEST_CODE -> {
                if (resultCode == RESULT_OK) {
                    data?.data?.let { contactUri ->
                        processSelectedContact(contactUri)
                    }
                }
            }
            EDIT_CONTACT_REQUEST_CODE -> {
                if (resultCode == RESULT_OK) {
                    data?.getParcelableExtra<EmergencyContact>("updated_contact")?.let { updatedContact ->
                        updateEmergencyContact(updatedContact)
                    }
                }
            }
        }
    }

    private fun processSelectedContact(contactUri: Uri) {
        val cursor: Cursor? = contentResolver.query(
            contactUri,
            null,
            null,
            null,
            null
        )

        cursor?.use {
            if (it.moveToFirst()) {
                val id = it.getString(it.getColumnIndexOrThrow(ContactsContract.Contacts._ID))
                val name = it.getString(it.getColumnIndexOrThrow(ContactsContract.Contacts.DISPLAY_NAME))
                val hasPhone = it.getString(it.getColumnIndexOrThrow(ContactsContract.Contacts.HAS_PHONE_NUMBER))

                if (hasPhone.toInt() > 0) {
                    val phoneCursor = contentResolver.query(
                        ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                        null,
                        ContactsContract.CommonDataKinds.Phone.CONTACT_ID + " = ?",
                        arrayOf(id),
                        null
                    )

                    phoneCursor?.use { pc ->
                        if (pc.moveToFirst()) {
                            val phoneNumber = pc.getString(pc.getColumnIndexOrThrow(
                                ContactsContract.CommonDataKinds.Phone.NUMBER))

                            if (!emergencyContacts.any { ec -> ec.phoneNumber == phoneNumber }) {
                                val contact = EmergencyContact(name, phoneNumber)
                                addEmergencyContact(contact)
                            } else {
                                Toast.makeText(this, "Contact already exists in emergency list", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                } else {
                    Toast.makeText(this, "Selected contact has no phone number", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun addEmergencyContact(contact: EmergencyContact) {
        emergencyContacts.add(contact)
        adapter.notifyItemInserted(emergencyContacts.size - 1)
        saveEmergencyContacts()
        Toast.makeText(this, "${contact.name} added as emergency contact", Toast.LENGTH_SHORT).show()
    }

    private fun showContactOptions(contact: EmergencyContact, position: Int) {
        val options = arrayOf(
            if (contact.isDefault) "Remove as default" else "Set as default",
            "Edit",
            "Delete",
            "Call now"
        )

        AlertDialog.Builder(this)
            .setTitle(contact.name)
            .setItems(options) { _, which ->
                when (which) {
                    0 -> toggleDefaultContact(contact, position)
                    1 -> editContact(contact, position)
                    2 -> deleteContact(contact, position)
                    3 -> callContact(contact)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun toggleDefaultContact(contact: EmergencyContact, position: Int) {
        emergencyContacts.forEach { it.isDefault = false }
        contact.isDefault = !contact.isDefault
        adapter.notifyDataSetChanged()
        saveEmergencyContacts()

        val message = if (contact.isDefault)
            "${contact.name} set as default contact"
        else
            "Default contact removed"
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    private fun editContact(contact: EmergencyContact, position: Int) {
        editPosition = position

        val intent = Intent(this, EditContactActivity::class.java).apply {
            putExtra("contact", contact)
        }
        startActivityForResult(intent, EDIT_CONTACT_REQUEST_CODE)
    }

    private fun updateEmergencyContact(updatedContact: EmergencyContact) {
        if (editPosition in 0 until emergencyContacts.size) {
            emergencyContacts[editPosition] = updatedContact
            adapter.notifyItemChanged(editPosition)
            saveEmergencyContacts()
            Toast.makeText(this, "Contact updated", Toast.LENGTH_SHORT).show()
        }
    }

    private fun deleteContact(contact: EmergencyContact, position: Int) {
        AlertDialog.Builder(this)
            .setTitle("Delete Contact")
            .setMessage("Are you sure you want to remove ${contact.name} from emergency contacts?")
            .setPositiveButton("Delete") { _, _ ->
                emergencyContacts.removeAt(position)
                adapter.notifyItemRemoved(position)
                saveEmergencyContacts()
                Toast.makeText(this, "Contact removed", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun callContact(contact: EmergencyContact) {
        val intent = Intent(Intent.ACTION_DIAL).apply {
            data = Uri.parse("tel:${contact.formattedPhoneNumber()}")
        }
        startActivity(intent)
    }

    private fun saveEmergencyContacts() {
        val sharedPref = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val editor = sharedPref.edit()
        val json = Json.encodeToString(emergencyContacts)
        editor.putString(CONTACTS_KEY, json)
        editor.apply()
    }

    private fun loadEmergencyContacts() {
        val sharedPref = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = sharedPref.getString(CONTACTS_KEY, null)

        if (json != null) {
            val contacts = Json.decodeFromString<List<EmergencyContact>>(json)
            emergencyContacts.clear()
            emergencyContacts.addAll(contacts)
            adapter.notifyDataSetChanged()
        }
    }
}