require "test_helper"

module Auth
  class GoogleSessionsControllerTest < ActionDispatch::IntegrationTest
    GOOGLE_SUB = "107691503500061507151".freeze

    setup do
      @previous_client_id = ENV["GOOGLE_CLIENT_ID"]
      ENV["GOOGLE_CLIENT_ID"] = "test-client-id.apps.googleusercontent.com"
    end

    teardown do
      ENV["GOOGLE_CLIENT_ID"] = @previous_client_id
    end

    # Claims as GoogleIdToken.verify would return them for a valid credential.
    def claims(overrides = {})
      {
        "sub" => GOOGLE_SUB,
        "email" => "player@example.com",
        "email_verified" => true
      }.merge(overrides)
    end

    # Posts /auth/google with GoogleIdToken.verify stubbed (no network in
    # tests). Swaps the singleton method by hand: minitest 6 (what the lock
    # resolves to) no longer ships minitest/mock's Object#stub.
    def post_google(stubbed_claims)
      original = GoogleIdToken.method(:verify)
      GoogleIdToken.define_singleton_method(:verify) { |_credential| stubbed_claims }
      post "/auth/google", params: { credential: "fake-google-jwt" }, as: :json
    ensure
      GoogleIdToken.define_singleton_method(:verify, original)
    end

    test "creates a user on first google sign-in and returns a session token" do
      assert_difference "User.count", 1 do
        post_google(claims)
      end
      assert_response :success

      body = JSON.parse(response.body)
      user = User.find_by!(google_uid: GOOGLE_SUB)
      assert_equal "player@example.com", user.email
      assert_equal user.id.to_s, JwtService.decode(body["token"])["sub"]
      assert_equal user.email, body.dig("user", "email")
    end

    test "links google to an existing password account with the same email" do
      existing = User.create!(email: "player@example.com", password: "hunter2secret")

      assert_no_difference "User.count" do
        post_google(claims)
      end
      assert_response :success
      assert_equal GOOGLE_SUB, existing.reload.google_uid

      body = JSON.parse(response.body)
      assert_equal existing.id.to_s, JwtService.decode(body["token"])["sub"]
    end

    test "finds a returning google user by uid even when the email changed" do
      user = User.create!(
        email: "old@example.com",
        password: SecureRandom.hex(32),
        google_uid: GOOGLE_SUB
      )

      assert_no_difference "User.count" do
        post_google(claims("email" => "new@example.com"))
      end
      assert_response :success

      body = JSON.parse(response.body)
      assert_equal user.id.to_s, JwtService.decode(body["token"])["sub"]
    end

    test "rejects an invalid credential" do
      assert_no_difference "User.count" do
        post_google(nil)
      end
      assert_response :unauthorized
    end

    test "rejects a credential whose email google has not verified" do
      assert_no_difference "User.count" do
        post_google(claims("email_verified" => false))
      end
      assert_response :unauthorized
    end

    test "responds 503 when GOOGLE_CLIENT_ID is not configured" do
      ENV["GOOGLE_CLIENT_ID"] = nil
      post "/auth/google", params: { credential: "anything" }, as: :json
      assert_response :service_unavailable
    end

    test "responds 400 when the credential param is missing" do
      post "/auth/google", params: {}, as: :json
      assert_response :bad_request
    end
  end
end
