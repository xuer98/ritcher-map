# A user-owned map pin (see CreateCustomMarkers). Always scoped through
# `current_user.custom_markers` in the controller, so a user can only ever see
# or touch their own. `map_id` is a cross-service reference (catalog map id) with
# no DB FK; x/y are pixel-space coordinates in that map's image CRS.
class CustomMarker < ApplicationRecord
  # A soft per-(user, map) cap: each marker is a payload-bearing row with a
  # free-text note, so unbounded growth would bloat storage and the map render
  # set. 200 is generous for personal use; raise if real usage needs more.
  MAX_PER_MAP = 200

  # Stored as #rrggbb so the renderer can tint pins directly; the UI offers a
  # fixed palette but the column accepts any valid hex.
  COLOR_FORMAT = /\A#[0-9a-fA-F]{6}\z/

  belongs_to :user

  before_validation :blank_to_nil

  validates :map_id, presence: true
  validates :x, :y, presence: true, numericality: true
  validates :label, length: { maximum: 120 }, allow_nil: true
  validates :note, length: { maximum: 4000 }, allow_nil: true
  validates :color, format: { with: COLOR_FORMAT, message: "must be a hex color" },
                    allow_nil: true
  validate :within_per_map_cap, on: :create

  private

  # Treat empty strings from the client as "unset" so optional fields stay null
  # (and an empty color doesn't trip the hex format check).
  def blank_to_nil
    self.label = nil if label.blank?
    self.note  = nil if note.blank?
    self.color = nil if color.blank?
  end

  def within_per_map_cap
    return if user_id.blank? || map_id.blank?
    if CustomMarker.where(user_id: user_id, map_id: map_id).count >= MAX_PER_MAP
      errors.add(:base, "you've reached the #{MAX_PER_MAP}-marker limit for this map")
    end
  end
end
