require "net/http"

# Verifies Google Identity Services ID tokens — the `credential` JWT the
# webapp's "Sign in with Google" button produces.
#
# Verification per https://developers.google.com/identity/gsi/web/guides/verify-google-id-token:
#   - RS256 signature against Google's published JWKS (fetched + cached here)
#   - `exp` not passed (checked by the jwt gem)
#   - `iss` is accounts.google.com (with or without scheme)
#   - `aud` equals our OAuth client id (ENV["GOOGLE_CLIENT_ID"])
#
# This is unrelated to JwtService: Google signs these tokens, we only read
# them. Our own HS256 session token is still minted by JwtService afterwards.
class GoogleIdToken
  FetchError = Class.new(StandardError)

  JWKS_URI = URI("https://www.googleapis.com/oauth2/v3/certs").freeze
  ISSUERS = ["https://accounts.google.com", "accounts.google.com"].freeze
  # Google rotates keys roughly daily; an hour keeps us fresh without a fetch
  # per login. A signature bearing an unknown kid invalidates the cache early.
  CACHE_TTL = 1.hour

  @cache_mutex = Mutex.new
  @cached_jwks = nil
  @fetched_at = nil

  class << self
    # Returns the verified claims hash, or nil when the credential is missing,
    # malformed, expired, signed with an unknown key, or minted for a
    # different OAuth client. Network failures fetching the JWKS also yield
    # nil (indistinguishable from invalid here; Google's JWKS is cached and
    # highly available, so in practice this means "try again").
    def verify(credential)
      client_id = ENV["GOOGLE_CLIENT_ID"].to_s.strip
      return nil if credential.blank? || client_id.blank?

      payload, _header = JWT.decode(
        credential, nil, true,
        algorithms: ["RS256"],
        jwks: method(:jwks_loader),
        verify_iss: true, iss: ISSUERS,
        verify_aud: true, aud: client_id
      )
      payload
    rescue JWT::DecodeError, FetchError, JSON::ParserError, SocketError, SystemCallError,
           Net::OpenTimeout, Net::ReadTimeout, OpenSSL::SSL::SSLError
      nil
    end

    private

    # Loader contract of the jwt gem: called with kid_not_found/invalidate
    # when the cached set lacks the token's kid, in which case we refetch.
    def jwks_loader(options = {})
      @cache_mutex.synchronize do
        stale = @fetched_at.nil? || Time.now - @fetched_at > CACHE_TTL
        if @cached_jwks.nil? || stale || options[:kid_not_found] || options[:invalidate]
          @cached_jwks = fetch_jwks
          @fetched_at = Time.now
        end
        @cached_jwks
      end
    end

    def fetch_jwks
      response = Net::HTTP.start(
        JWKS_URI.host, JWKS_URI.port,
        use_ssl: true, open_timeout: 3, read_timeout: 3
      ) { |http| http.get(JWKS_URI.request_uri) }
      raise FetchError, "JWKS fetch returned #{response.code}" unless response.is_a?(Net::HTTPOK)

      JWT::JWK::Set.new(JSON.parse(response.body))
    end
  end
end
