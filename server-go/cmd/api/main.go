package main

import (
	"bufio"
	"log"
	"net/http"
	"os"
	"strings"

	"blog/server-go/internal/api"
	"blog/server-go/internal/config"
	"blog/server-go/internal/password"
	"blog/server-go/internal/ratelimit"
	"blog/server-go/internal/service"
)

func main() {
	loadDotEnv(".env", "../.env")
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	db, err := service.Open(cfg.DSN)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	store := &service.Store{
		DB:     db,
		Config: cfg,
		Keys:   password.NewKeyStore(),
		Limit:  ratelimit.New(),
	}
	log.Printf("go api listening on %s", cfg.Addr)
	if err := http.ListenAndServe(cfg.Addr, api.New(store).Handler()); err != nil {
		log.Fatal(err)
	}
}

func loadDotEnv(paths ...string) {
	for _, path := range paths {
		f, err := os.Open(path)
		if err != nil {
			continue
		}
		sc := bufio.NewScanner(f)
		for sc.Scan() {
			line := strings.TrimSpace(sc.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			key, val, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}
			key = strings.TrimSpace(key)
			val = strings.Trim(strings.TrimSpace(val), `"'`)
			if key == "" || os.Getenv(key) != "" {
				continue
			}
			_ = os.Setenv(key, val)
		}
		_ = f.Close()
	}
}
