const VERIFICATION_STATUSES = new Set(['unverified', 'needs_information', 'verified', 'rejected']);
const VERIFICATION_METHODS = new Set(['phone_callback', 'field_visit', 'agency_confirmation', 'document_review']);
const ADMIN_REQUEST_STATUSES = new Set(['pending', 'in_progress', 'finished']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reviewError(body, request) {
  if (!['verified', 'needs_information', 'rejected'].includes(body.decision)) return 'Choose a verification decision';
  if (!VERIFICATION_METHODS.has(body.method)) return 'Choose the verification method actually used';
  if (typeof body.notes !== 'string' || body.notes.trim().length < 10 || body.notes.length > 2000) return 'Record a review reason between 10 and 2000 characters';
  if (!VERIFICATION_STATUSES.has(body.expected_verification_status)) return 'Reload the request before reviewing';
  if (body.expected_verification_status !== request.verification_status) return 'Another reviewer changed this request. Reload before deciding';
  if (request.admin_status === 'finished' || ['resolved', 'cancelled'].includes(request.status)) return 'Closed requests cannot be reviewed';
  if (body.decision === 'needs_information' && request.admin_status !== 'pending') return 'The response has already started. Contact the recipient through the assigned coordinator; the submission cannot be reopened for editing';
  if (body.decision === 'verified' && request.emergency_type === 'donation') {
    if (!request.user_id) return 'A registered recipient is required for goods requests';
    const items = request.requested_items;
    if (!Array.isArray(items) || items.length === 0) return 'The recipient must provide the requested items and quantities before approval';
    if (items.some(item => !item || typeof item.item_name !== 'string' || !item.item_name.trim() || typeof item.unit !== 'string' || !item.unit.trim() || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) return 'Each requested item needs a name, unit, and positive quantity';
  }
  return null;
}

function transitionError(request, next, reason) {
  if (!ADMIN_REQUEST_STATUSES.has(next)) return 'Status must be pending, in_progress, or finished';
  if (typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 2000) return 'Record a status-change reason between 10 and 2000 characters';
  const current = request.admin_status || 'pending';
  if (current === next) return null;
  if (current === 'finished') return 'Closed requests cannot be reopened through this action';
  if (next === 'pending') return 'Use a verification review to request more information';
  if (next === 'finished' && current !== 'in_progress') return 'Start the response before closing the request';
  if (request.verification_status === 'rejected') return 'Rejected requests cannot enter the response workflow';
  if (request.emergency_type === 'donation' && request.verification_status !== 'verified') return 'Goods requests require confirmed need before fulfillment';
  return null;
}

module.exports = { VERIFICATION_STATUSES, VERIFICATION_METHODS, ADMIN_REQUEST_STATUSES, UUID_PATTERN, reviewError, transitionError };
