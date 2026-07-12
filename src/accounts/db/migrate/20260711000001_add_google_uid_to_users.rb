class AddGoogleUidToUsers < ActiveRecord::Migration[8.0]
  def change
    # Google's stable subject id (`sub` claim). Nullable: password-only
    # accounts never get one. Postgres unique indexes ignore NULLs.
    add_column :users, :google_uid, :string
    add_index :users, :google_uid, unique: true
  end
end
