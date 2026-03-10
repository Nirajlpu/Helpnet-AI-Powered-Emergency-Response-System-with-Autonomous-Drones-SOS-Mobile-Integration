import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.parcelize)

    alias(libs.plugins.kotlin.plugin.serialization) // Add this line
}

android {
    namespace = "com.example.helpnet"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.example.helpnet"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"


        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        val localProperties = Properties()
        val localPropertiesFile = rootProject.file("local.properties")
        if (localPropertiesFile.exists()) {
            localProperties.apply { load(localPropertiesFile.inputStream()) }
        }
        val mapsApiKey = localProperties.getProperty("MAPS_API_KEY") ?: "YOUR_API_KEY"
        manifestPlaceholders["MAPS_API_KEY"] = mapsApiKey
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    // AndroidX
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.constraintlayout)

    // Navigation
    implementation(libs.androidx.navigation.runtime.ktx)
    implementation(libs.androidx.navigation.ui.ktx)

    // Google Play Services
    implementation(libs.play.services.location)
    
    // OpenStreetMap (osmdroid) instead of Google Maps
    implementation("org.osmdroid:osmdroid-android:6.1.20")

    // Serialization
    implementation(libs.kotlinx.serialization.json) // Add this line

    // Testing
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)

    // Networking - OkHttp for simple HTTP calls to backend
    implementation("com.squareup.okhttp3:okhttp:4.10.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.10.0")

    // Retrofit + Moshi
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-moshi:2.9.0")
    implementation("com.squareup.moshi:moshi-kotlin:1.15.0")

    // CameraX for background recording in foreground service
    implementation("androidx.camera:camera-core:1.2.3")
    implementation("androidx.camera:camera-camera2:1.2.3")
    implementation("androidx.camera:camera-lifecycle:1.2.3")
    implementation("androidx.camera:camera-video:1.2.3")

    // Lifecycle service
    implementation("androidx.lifecycle:lifecycle-service:2.6.1")
    // WorkManager for reliable uploads
    implementation("androidx.work:work-runtime-ktx:2.8.1")
    
    // WebRTC for Live Video Streaming
    implementation("io.getstream:stream-webrtc-android:1.1.1")
}