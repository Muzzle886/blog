package password

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"testing"
)

func TestScryptMatchesNode(t *testing.T) {
	const stored = "scrypt$16384$8$1$00112233445566778899aabbccddeeff$7b052cef88fa90f0538e05097ff63183bb6d601da2543868545d7e89d2894fc30d8ba43cbf5986a756a7768fbe5aa3b44d5a496bb9f9068c7308a13465f2ca08"
	got, err := Verify("password123", stored)
	if err != nil {
		t.Fatal(err)
	}
	if !got.Valid || !got.NeedsRehash {
		t.Fatalf("verify = %+v", got)
	}
	bad, err := Verify("nope", stored)
	if err != nil {
		t.Fatal(err)
	}
	if bad.Valid {
		t.Fatal("expected mismatch")
	}
}

func TestRSARoundTrip(t *testing.T) {
	store := NewKeyStore()
	pub, err := store.Public()
	if err != nil {
		t.Fatal(err)
	}
	store.mu.Lock()
	priv := store.current.private
	store.mu.Unlock()

	plain := "p@ssw0rd"
	ciphertext, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, &priv.PublicKey, []byte(plain), nil)
	if err != nil {
		t.Fatal(err)
	}
	envelope := envelopePrefix + ":" + pub.KeyID + ":" + base64.StdEncoding.EncodeToString(ciphertext)
	got := store.Decrypt(envelope)
	if !got.OK || got.Plaintext != plain {
		t.Fatalf("decrypt = %+v", got)
	}
	if store.Decrypt("plaintext").Reason != "malformed" {
		t.Fatal("plaintext must be rejected")
	}
	if store.Decrypt(envelopePrefix+":deadbeefdeadbeef:aaaa").Reason != "unknown_key" {
		t.Fatal("unknown key")
	}
}
