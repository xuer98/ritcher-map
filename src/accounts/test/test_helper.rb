ENV["RAILS_ENV"] ||= "test"
# JwtService reads this lazily on every encode/decode; any value works in
# tests (nothing here cross-checks with the gateway).
ENV["JWT_SECRET"] ||= "test-secret"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # Add more helper methods to be used by all tests here...
  end
end
