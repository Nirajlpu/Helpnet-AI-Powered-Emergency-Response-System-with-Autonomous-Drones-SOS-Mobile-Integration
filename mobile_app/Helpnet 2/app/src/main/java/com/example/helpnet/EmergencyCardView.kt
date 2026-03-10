package com.example.helpnet

import android.content.Context
import android.util.AttributeSet
import android.view.LayoutInflater
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat

class EmergencyCardView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private val iconView: ImageView
    private val labelText: TextView
    private val iconBackground: FrameLayout

    init {
        LayoutInflater.from(context).inflate(R.layout.emergency_card, this, true)

        iconView = findViewById(R.id.icon)
        labelText = findViewById(R.id.labelText)
        iconBackground = findViewById(R.id.iconBackground)

        attrs?.let {
            val typedArray = context.obtainStyledAttributes(it, R.styleable.EmergencyCard)

            val label = typedArray.getString(R.styleable.EmergencyCard_label)
            val iconRes = typedArray.getResourceId(R.styleable.EmergencyCard_icon, -1)
            val color = typedArray.getColor(R.styleable.EmergencyCard_color, 0xFFE0E0E0.toInt())

            labelText.text = label
            if (iconRes != -1) {
                iconView.setImageResource(iconRes)
            }
            iconBackground.backgroundTintList = ContextCompat.getColorStateList(context, color)

            typedArray.recycle()
        }
    }
}