package password

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"math/big"
	"strings"
	"sync"
	"time"
)

const (
	envelopePrefix = "rsa-oaep-sha256"
	rotateAfter    = 12 * time.Hour
)

type keyPair struct {
	private   *rsa.PrivateKey
	keyID     string
	createdAt time.Time
	jwk       jwk
}

type jwk struct {
	Kty string `json:"kty"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type PublicKeyPayload struct {
	KeyID      string `json:"keyId"`
	Algorithm  string `json:"algorithm"`
	PublicKey  jwk    `json:"publicKey"`
	RotateInMs int64  `json:"rotateInMs"`
}

type DecryptResult struct {
	OK        bool
	Plaintext string
	Reason    string
}

type KeyStore struct {
	mu       sync.Mutex
	current  *keyPair
	previous *keyPair
}

func NewKeyStore() *KeyStore {
	return &KeyStore{}
}

func (s *KeyStore) Public() (PublicKeyPayload, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.rotateLocked(time.Now()); err != nil {
		return PublicKeyPayload{}, err
	}
	left := rotateAfter - time.Since(s.current.createdAt)
	if left < 0 {
		left = 0
	}
	return PublicKeyPayload{
		KeyID:      s.current.keyID,
		Algorithm:  "RSA-OAEP-256",
		PublicKey:  s.current.jwk,
		RotateInMs: left.Milliseconds(),
	}, nil
}

func (s *KeyStore) Decrypt(envelope string) DecryptResult {
	first := strings.IndexByte(envelope, ':')
	if first < 0 || envelope[:first] != envelopePrefix {
		return DecryptResult{Reason: "malformed"}
	}
	rest := envelope[first+1:]
	second := strings.IndexByte(rest, ':')
	if second <= 0 || second == len(rest)-1 {
		return DecryptResult{Reason: "malformed"}
	}
	keyID := rest[:second]
	raw, err := base64.StdEncoding.DecodeString(rest[second+1:])
	if err != nil || len(raw) == 0 {
		return DecryptResult{Reason: "malformed"}
	}

	s.mu.Lock()
	pair := s.matchLocked(keyID)
	s.mu.Unlock()
	if pair == nil {
		return DecryptResult{Reason: "unknown_key"}
	}

	plain, err := rsa.DecryptOAEP(sha256.New(), rand.Reader, pair.private, raw, nil)
	if err != nil {
		return DecryptResult{Reason: "decrypt_failed"}
	}
	return DecryptResult{OK: true, Plaintext: string(plain)}
}

func (s *KeyStore) matchLocked(keyID string) *keyPair {
	if s.current != nil && s.current.keyID == keyID {
		return s.current
	}
	if s.previous != nil && s.previous.keyID == keyID {
		return s.previous
	}
	return nil
}

func (s *KeyStore) rotateLocked(now time.Time) error {
	if s.current != nil && now.Sub(s.current.createdAt) <= rotateAfter {
		return nil
	}
	pair, err := generate()
	if err != nil {
		return err
	}
	if s.current != nil {
		s.previous = s.current
	}
	s.current = pair
	return nil
}

func generate() (*keyPair, error) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}
	der, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(der)
	return &keyPair{
		private:   priv,
		keyID:     hex.EncodeToString(sum[:])[:16],
		createdAt: time.Now(),
		jwk: jwk{
			Kty: "RSA",
			N:   base64.RawURLEncoding.EncodeToString(priv.N.Bytes()),
			E:   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(priv.E)).Bytes()),
		},
	}, nil
}
