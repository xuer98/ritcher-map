module Auth
  class GoogleSessionsController < ApplicationController
    # POST /auth/google  { "credential": "<Google ID token from the GIS button>" }
    #
    # Exchanges a verified Google credential for the same {token, user} session
    # payload as /auth/login. Matching order:
    #   1. returning Google user  -> by google_uid (survives email changes)
    #   2. existing password user -> by email; links google_uid to that account
    #   3. otherwise              -> creates a user (random password: the users
    #      table requires a digest, and these accounts sign in via Google)
    def create
      credential = params.require(:credential)
      if ENV["GOOGLE_CLIENT_ID"].to_s.strip.empty?
        return render json: { error: "google sign-in is not configured" }, status: :service_unavailable
      end

      claims = GoogleIdToken.verify(credential)
      unless usable?(claims)
        return render json: { error: "invalid google credential" }, status: :unauthorized
      end

      user = find_or_link_or_create(claims)
      render json: {
        token: JwtService.encode(user),
        user: UserSerializer.call(user)
      }
    end

    private

    # Linking by email hands the account to whoever controls the Google
    # credential, so only accept addresses Google itself has verified.
    def usable?(claims)
      claims.present? &&
        claims["sub"].present? &&
        claims["email"].present? &&
        [true, "true"].include?(claims["email_verified"])
    end

    def find_or_link_or_create(claims)
      google_uid = claims["sub"]
      email = claims["email"].to_s.downcase.strip

      if (user = User.find_by(google_uid: google_uid))
        return user
      end

      if (user = User.find_by(email: email))
        user.update!(google_uid: google_uid)
        return user
      end

      User.create!(email: email, google_uid: google_uid, password: SecureRandom.hex(32))
    rescue ActiveRecord::RecordNotUnique
      # Two first sign-ins raced; the other request won. Use its row.
      User.find_by(google_uid: google_uid) || User.find_by!(email: email)
    end
  end
end
