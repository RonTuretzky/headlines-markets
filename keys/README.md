# Demo DKIM signing key

`dev-dkim.pem` / `dev-dkim.pub` is a **throwaway RSA-2048 keypair for the local demo
only**. It signs the sample `.eml` fixtures in `emails/` (`pnpm dkim:sign-fixtures`) so
they carry *real* DKIM signatures that the onchain `DKIMVerifier` verifies for real. Its
public key is registered in `DKIMRegistry` for the demo newspaper domains.

It is **not** any real domain's key and controls nothing — it exists so the signature
verification path is exercised with genuine RSA signatures without needing a newspaper's
private key. The real New York Times *public* key is also registered (from DNS), and a
real NYT email verifies against it end to end.
