package com.example.helpnet

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class EmergencyServiceInstrumentedTest {
    @Test
    fun service_can_start() {
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext
        // This is an instrumentation placeholder: start the service and verify no crash.
        val intent = android.content.Intent(appContext, EmergencyService::class.java)
        appContext.startService(intent)
        // Stop immediately - this test ensures the service can be started in instrumentation.
        appContext.stopService(intent)
    }
}
