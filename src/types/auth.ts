export interface GoogleUserResponse {
	id: string
	email: string
	verified_email: boolean
	name: string
	given_name: string
	family_name: string
	picture: string
	locale: string
}

export interface GoogleUser {
	id: string
	email: string
	name: string
	picture?: string
}

export interface DbUser {
	id: number
	googleId: string
	email: string
	fullName: string
	avatarUrl: string
}

export interface TokenResponse {
	token: string
	expires_in: number
}
