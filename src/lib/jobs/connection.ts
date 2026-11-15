const aliasedSslMode = /([?&])sslmode=(?:prefer|require|verify-ca)(?=&|#|$)/gi;

// pg currently treats prefer, require, and verify-ca as verify-full, and warns
// unless the connection string says verify-full. Keep that check; do not loosen it.
export function databaseConnectionString(connectionString: string): string {
  return connectionString.replace(aliasedSslMode, "$1sslmode=verify-full");
}
