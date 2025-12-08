// utils/passwordHistory.js
// Small helper to log password changes safely (hash only).

const addPasswordHistoryEntry = async (user, passwordHash, options = {}) => {
  const { changedBy = null, isTemporary = false } = options;

  if (!user.passwordHistory) user.passwordHistory = [];

  user.passwordHistory.push({
    passwordHash,
    changedAt: new Date(),
    changedBy,
    isTemporary,
  });

  // Optional: keep only last N entries
  const MAX_HISTORY = 5;
  if (user.passwordHistory.length > MAX_HISTORY) {
    user.passwordHistory = user.passwordHistory.slice(
      user.passwordHistory.length - MAX_HISTORY
    );
  }
};

module.exports = { addPasswordHistoryEntry };
