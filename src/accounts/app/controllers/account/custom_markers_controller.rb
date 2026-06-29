module Account
  # CRUD for the signed-in user's own map pins. Every action is scoped through
  # `current_user.custom_markers`, so a user can never read or mutate another
  # user's rows (a forged id just 404s). Auth is enforced by Authenticatable.
  class CustomMarkersController < ApplicationController
    include Authenticatable

    # GET /account/custom_markers?map_id=123  -> this user's markers on a map
    def index
      markers = current_user.custom_markers
                            .where(map_id: params.require(:map_id))
                            .order(:created_at, :id) # stable tiebreaker
      render json: markers.map { |m| CustomMarkerSerializer.call(m) }
    end

    # POST /account/custom_markers
    def create
      marker = current_user.custom_markers.create!(create_params)
      render json: CustomMarkerSerializer.call(marker), status: :created
    end

    # PATCH/PUT /account/custom_markers/:id
    def update
      marker = find_marker!
      marker.update!(update_params)
      render json: CustomMarkerSerializer.call(marker)
    end

    # DELETE /account/custom_markers/:id
    def destroy
      find_marker!.destroy!
      head :no_content
    end

    private

    # A syntactically invalid UUID makes Postgres reject the query with
    # StatementInvalid; treat it like any other miss (404) rather than a 500.
    def find_marker!
      current_user.custom_markers.find(params[:id])
    rescue ActiveRecord::StatementInvalid
      raise ActiveRecord::RecordNotFound
    end

    def create_params
      params.permit(:map_id, :x, :y, :label, :note, :color)
    end

    # map_id is intentionally NOT permitted on update: a marker can't move
    # between maps (which would also dodge the per-map cap, enforced on create).
    def update_params
      params.permit(:x, :y, :label, :note, :color)
    end
  end
end
