package com.example.helpnet

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class EmergencyContactsAdapter(
    private val contacts: List<EmergencyContactsActivity.EmergencyContact>,
    private val onItemClick: (EmergencyContactsActivity.EmergencyContact, Int) -> Unit
) : RecyclerView.Adapter<EmergencyContactsAdapter.ViewHolder>() {

    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val nameTextView: TextView = itemView.findViewById(R.id.tvContactName)
        val phoneTextView: TextView = itemView.findViewById(R.id.tvContactPhone)
        val defaultIcon: ImageView = itemView.findViewById(R.id.ivDefault)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_emergency_contact, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val contact = contacts[position]
        holder.nameTextView.text = contact.name
        holder.phoneTextView.text = contact.phoneNumber

        if (contact.isDefault) {
            holder.defaultIcon.visibility = View.VISIBLE
        } else {
            holder.defaultIcon.visibility = View.GONE
        }

        holder.itemView.setOnClickListener {
            onItemClick(contact, position)
        }
    }

    override fun getItemCount() = contacts.size
}