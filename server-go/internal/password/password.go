package password

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/scrypt"
)

const (
	saltBytes = 16
	keyLen    = 64
	curN      = 1 << 17
	curR      = 8
	curP      = 1
)

type VerifyResult struct {
	Valid       bool
	NeedsRehash bool
}

func Hash(pw string) (string, error) {
	salt := make([]byte, saltBytes)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	derived, err := scrypt.Key([]byte(pw), salt, curN, curR, curP, keyLen)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("scrypt$%d$%d$%d$%s$%s", curN, curR, curP, hex.EncodeToString(salt), hex.EncodeToString(derived)), nil
}

func Verify(pw, stored string) (VerifyResult, error) {
	n, r, p, salt, expected, ok := parse(stored)
	if !ok || len(expected) != keyLen {
		return VerifyResult{}, nil
	}
	derived, err := scrypt.Key([]byte(pw), salt, n, r, p, keyLen)
	if err != nil {
		return VerifyResult{}, err
	}
	valid := subtle.ConstantTimeCompare(derived, expected) == 1
	rehash := valid && (n != curN || r != curR || p != curP)
	return VerifyResult{Valid: valid, NeedsRehash: rehash}, nil
}

func parse(stored string) (n, r, p int, salt, expected []byte, ok bool) {
	parts := strings.Split(stored, "$")
	if len(parts) == 0 || parts[0] != "scrypt" {
		return 0, 0, 0, nil, nil, false
	}
	switch len(parts) {
	case 6:
		n, okN := atoi(parts[1])
		r, okR := atoi(parts[2])
		p, okP := atoi(parts[3])
		salt, errS := hex.DecodeString(parts[4])
		expected, errH := hex.DecodeString(parts[5])
		if !okN || !okR || !okP || errS != nil || errH != nil {
			return 0, 0, 0, nil, nil, false
		}
		return n, r, p, salt, expected, true
	case 3:
		salt, errS := hex.DecodeString(parts[1])
		expected, errH := hex.DecodeString(parts[2])
		if errS != nil || errH != nil {
			return 0, 0, 0, nil, nil, false
		}
		return 1 << 14, 8, 1, salt, expected, true
	default:
		return 0, 0, 0, nil, nil, false
	}
}

func atoi(s string) (int, bool) {
	n, err := strconv.Atoi(s)
	if err != nil || n <= 0 {
		return 0, false
	}
	return n, true
}
