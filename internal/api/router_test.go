package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/hiroshiyoka/orpheus/internal/storage"
)

func TestHealth(t *testing.T) {
	db, err := storage.Open(filepath.Join(t.TempDir(), "orpheus.db"), filepath.Join("..", "..", "migrations", "0001_init.sql"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	r := NewRouter(db, "")
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestCloudflareZones(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer token" {
			t.Fatalf("unexpected authorization: %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"success":true,"result":[{"id":"z1","name":"example.com","status":"active"}],"result_info":{"total_pages":1}}`))
	}))
	defer srv.Close()

	original := cloudflareZonesEndpoint
	cloudflareZonesEndpoint = srv.URL
	defer func() { cloudflareZonesEndpoint = original }()

	r := NewRouter(nil, "token")
	req := httptest.NewRequest(http.MethodGet, "/api/cloudflare/zones", nil)

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d: %s", rec.Code, rec.Body.String())
	}
	var body struct {
		Zones []cloudflareZone `json:"zones"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Zones) != 1 || body.Zones[0].ID != "z1" || body.Zones[0].Name != "example.com" {
		t.Fatalf("unexpected zones: %+v", body.Zones)
	}
}

func TestCloudflareWorkers(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer token" {
			t.Fatalf("unexpected authorization: %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/accounts":
			w.Write([]byte(`{"success":true,"result":[{"id":"acc1","name":"My Account"}]}`))
		case "/accounts/acc1/workers/subdomain":
			w.Write([]byte(`{"success":true,"result":{"subdomain":"me"}}`))
		case "/accounts/acc1/workers/scripts":
			w.Write([]byte(`{"success":true,"result":[{"id":"api"},{"id":"web"}]}`))
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer srv.Close()

	original := cloudflareAccountsEndpoint
	cloudflareAccountsEndpoint = srv.URL + "/accounts"
	defer func() { cloudflareAccountsEndpoint = original }()

	r := NewRouter(nil, "token")
	req := httptest.NewRequest(http.MethodGet, "/api/cloudflare/workers", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d: %s", rec.Code, rec.Body.String())
	}
	var body struct {
		Workers []cloudflareWorker `json:"workers"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Workers) != 2 {
		t.Fatalf("unexpected workers: %+v", body.Workers)
	}
	if body.Workers[0].Name != "api" || body.Workers[0].URL != "https://api.me.workers.dev/" {
		t.Fatalf("unexpected worker: %+v", body.Workers[0])
	}
	if body.Workers[1].AccountName != "My Account" {
		t.Fatalf("unexpected worker account: %+v", body.Workers[1])
	}
}
