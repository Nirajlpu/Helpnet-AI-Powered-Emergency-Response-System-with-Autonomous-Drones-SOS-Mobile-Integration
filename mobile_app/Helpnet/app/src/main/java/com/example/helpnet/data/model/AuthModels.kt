package com.example.helpnet.data.model

import com.squareup.moshi.JsonClass


data class AuthRequest(
    val username: String? = null,
    val password: String? = null,
    val email: String? = null
)


data class AuthResponse(
    val token: String?,
    val user_id: Int?,
    val username: String?,
    val user: UserDto?
)


data class UserDto(
    val id: Int,
    val username: String,
    val email: String? = null
)
