export function normalizeProfileType(value) {
  const lowered = String(value || '').trim().toLowerCase();
  if (lowered === 'company' || lowered === 'business') return 'company';
  return 'user';
}

// Platform rules:
// - Users cannot donate to businesses
// - Businesses cannot donate to businesses
// - Businesses can donate to users
// (User->User is allowed unless explicitly restricted elsewhere.)
export function isSupportAllowed({ supporterProfile, recipientProfile }) {
  const supporter = normalizeProfileType(supporterProfile);
  const recipient = normalizeProfileType(recipientProfile);

  // Never prompt support/wallet when the recipient is a business.
  if (recipient === 'company') return false;

  // Recipient is a user: support is allowed for both user and company supporters.
  return supporter === 'user' || supporter === 'company';
}

