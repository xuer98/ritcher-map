# Consistent custom-marker representation. camelCase keys match the catalog's
# marker wire (the webapp consumes both with the same conventions); x/y are
# emitted as numbers and timestamps as ISO8601 strings.
class CustomMarkerSerializer
  def self.call(marker)
    {
      id: marker.id,
      userId: marker.user_id,
      mapId: marker.map_id,
      x: marker.x.to_f,
      y: marker.y.to_f,
      label: marker.label,
      note: marker.note,
      color: marker.color,
      createdAt: marker.created_at&.iso8601,
      updatedAt: marker.updated_at&.iso8601
    }
  end
end
