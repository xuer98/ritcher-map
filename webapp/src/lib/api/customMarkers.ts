import { apiGet, apiSend } from './client';

// Per-user "My Markers": pins the signed-in player drops on a map. These live in
// the accounts service (a user-owned resource), NOT the catalog, so every call
// is authed and routes under /account/*. Unlike catalog marker ids (numbers),
// custom-marker ids are UUID STRINGS — kept string-typed end to end.

/** A user's custom map pin, as the accounts service returns it (camelCase). */
export interface CustomMarker {
  id: string;
  userId: string;
  mapId: number;
  x: number;
  y: number;
  label: string | null;
  note: string | null;
  /** #rrggbb tint, or null for the default. */
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Editable fields of a custom marker (position + the three content fields). */
export interface CustomMarkerInput {
  x: number;
  y: number;
  label?: string | null;
  note?: string | null;
  color?: string | null;
}

/** The accounts service permits snake_case params; build the wire body here. */
function toBody(patch: Partial<CustomMarkerInput>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.x !== undefined) body.x = patch.x;
  if (patch.y !== undefined) body.y = patch.y;
  if (patch.label !== undefined) body.label = patch.label;
  if (patch.note !== undefined) body.note = patch.note;
  if (patch.color !== undefined) body.color = patch.color;
  return body;
}

/** This user's custom markers on a map (authed). */
export function listCustomMarkers(mapId: number): Promise<CustomMarker[]> {
  return apiGet<CustomMarker[]>(`/account/custom_markers?map_id=${mapId}`, {
    auth: true,
  });
}

/** Create a custom marker on a map (authed). */
export function createCustomMarker(
  mapId: number,
  input: CustomMarkerInput,
): Promise<CustomMarker> {
  return apiSend<CustomMarker>(
    'POST',
    '/account/custom_markers',
    { map_id: mapId, ...toBody(input) },
    { auth: true },
  );
}

/** Patch a custom marker's editable fields (authed). */
export function updateCustomMarker(
  id: string,
  patch: Partial<CustomMarkerInput>,
): Promise<CustomMarker> {
  return apiSend<CustomMarker>(
    'PATCH',
    `/account/custom_markers/${id}`,
    toBody(patch),
    { auth: true },
  );
}

/** Delete a custom marker (authed; resolves on 204). */
export function deleteCustomMarker(id: string): Promise<void> {
  return apiSend<void>('DELETE', `/account/custom_markers/${id}`, undefined, {
    auth: true,
  });
}
