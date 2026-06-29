# Per-user "My Markers": pins a logged-in player drops on a map, with a label,
# a markdown note and a color. Unlike catalog markers (admin CMS content in the
# catalog service), these are user-owned, so they live here in the accounts DB
# alongside `users`. `map_id` references a catalog map in a DIFFERENT database,
# so there is intentionally NO foreign key for it — the webapp tolerates markers
# whose map no longer exists.
class CreateCustomMarkers < ActiveRecord::Migration[8.0]
  def change
    create_table :custom_markers, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.bigint :map_id, null: false
      t.float  :x, null: false
      t.float  :y, null: false
      t.string :label
      t.text   :note
      t.string :color
      t.timestamps
    end

    # The hot query is "this user's markers on this map".
    add_index :custom_markers, %i[user_id map_id]
  end
end
