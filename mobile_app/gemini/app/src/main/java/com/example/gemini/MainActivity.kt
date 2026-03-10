package com.example.gemini

import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.google.ai.client.generativeai.GenerativeModel
import kotlinx.coroutines.*

class MainActivity : AppCompatActivity() {

    lateinit var etFood: EditText
    lateinit var btnSuggest: Button
    lateinit var txtResult: TextView

    val apiKey = "AIzaSyBAwLeUefm5FOsv06_xKrR4Ho1cTfgMmcI"

    override fun onCreate(savedInstanceState: Bundle?) {

        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        etFood = findViewById(R.id.etFood)
        btnSuggest = findViewById(R.id.btnSuggest)
        txtResult = findViewById(R.id.txtResult)

        btnSuggest.setOnClickListener {

            val userInput = etFood.text.toString()

            getFoodSuggestion(userInput)
        }
    }

    private fun getFoodSuggestion(query: String) {

        val generativeModel = GenerativeModel(
            modelName = "gemini-2.5-flash",
            apiKey = apiKey
        )

        CoroutineScope(Dispatchers.IO).launch {

            try {

                val prompt = "Suggest 5 food items for $query lovers"

                val response = generativeModel.generateContent(prompt)

                withContext(Dispatchers.Main) {

                    txtResult.text = response.text
                }

            } catch (e: Exception) {

                withContext(Dispatchers.Main) {

                    txtResult.text = "Error: ${e.message}"
                }
            }
        }
    }
}