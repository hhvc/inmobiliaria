const PASSWORD_PROVIDER_ID = "password";

export const getPrimaryAuthProviderId = (firebaseUser = {}) => (
  firebaseUser.providerData?.find((item) => item?.providerId)?.providerId || ""
);

export const isFreshPasswordAccount = (firebaseUser = {}) => {
  if (getPrimaryAuthProviderId(firebaseUser) !== PASSWORD_PROVIDER_ID) return false;
  const createdAt = Date.parse(firebaseUser.metadata?.creationTime || "");
  const lastSignInAt = Date.parse(firebaseUser.metadata?.lastSignInTime || "");
  return Number.isFinite(createdAt) && Number.isFinite(lastSignInAt) &&
    Math.abs(createdAt - lastSignInAt) <= 5000;
};
export const isEmailVerificationPending = (firebaseUser = {}, userData = {}) => (
  userData.emailVerificationRequired === true &&
  getPrimaryAuthProviderId(firebaseUser) === PASSWORD_PROVIDER_ID &&
  firebaseUser.emailVerified !== true
);

export const normalizeArgentinaMobileDigits = (value = "") => (
  value.toString().replace(/\D/g, "").slice(0, 10)
);

export const buildArgentinaMobileE164 = (value = "") => {
  const digits = normalizeArgentinaMobileDigits(value);
  return digits.length === 10 ? `+549${digits}` : "";
};
