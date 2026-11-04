package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/hiroshiyoka/orpheus/internal/storage"
)

func setupTestDB(t *testing.T) *storage.Project {
	return nil
}

func TestUptimeEndpoint_Validation(t *testing.T) {
	db, err := storage.Open(filepath.Join(t.TempDir(), "orpheus.db"), filepath.Join("..", "..", "migrations", "0001_init.sql"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	r := NewRouter(db, "")

	// Method not allowed
	req := httptest.NewRequest(http.MethodPost, "/api/uptime", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for POST, got %d", rec.Code)
	}

	// Invalid window
	req = httptest.NewRequest(http.MethodGet, "/api/uptime?window=30d", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid window, got %d", rec.Code)
	}

	// Invalid buckets string
	req = httptest.NewRequest(http.MethodGet, "/api/uptime?buckets=notanumber", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid buckets, got %d", rec.Code)
	}
}

func TestUptimeEndpoint_BucketsClampingAndDefaults(t *testing.T) {
	db, err := storage.Open(filepath.Join(t.TempDir(), "orpheus.db"), filepath.Join("..", "..", "migrations", "0001_init.sql"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	_, err = storage.CreateProject(db, storage.Project{
		Name:     "Test Project",
		URL:      "https://example.com",
		IsActive: true,
	})
	if err != nil {
		t.Fatal(err)
	}

	r := NewRouter(db, "")

	// Default buckets (60) and default window (24h)
	req := httptest.NewRequest(http.MethodGet, "/api/uptime", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var res []projectUptimeResponse
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatal(err)
	}
	if len(res) != 1 || len(res[0].Buckets) != 60 {
		t.Fatalf("expected 1 project with 60 buckets, got %d projects, %d buckets", len(res), len(res[0].Buckets))
	}

	// Clamp buckets to maximum 120
	req = httptest.NewRequest(http.MethodGet, "/api/uptime?buckets=500", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	res = nil
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatal(err)
	}
	if len(res[0].Buckets) != 120 {
		t.Fatalf("expected clamped 120 buckets, got %d", len(res[0].Buckets))
	}

	// Clamp buckets to minimum 1
	req = httptest.NewRequest(http.MethodGet, "/api/uptime?buckets=-5", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	res = nil
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatal(err)
	}
	if len(res[0].Buckets) != 1 {
		t.Fatalf("expected clamped 1 bucket, got %d", len(res[0].Buckets))
	}

	// 7d window accepted
	req = httptest.NewRequest(http.MethodGet, "/api/uptime?window=7d&buckets=30", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	res = nil
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatal(err)
	}
	if len(res[0].Buckets) != 30 {
		t.Fatalf("expected 30 buckets, got %d", len(res[0].Buckets))
	}
}

func TestUptimeEndpoint_BucketStatusesAndUptime(t *testing.T) {
	db, err := storage.Open(filepath.Join(t.TempDir(), "orpheus.db"), filepath.Join("..", "..", "migrations", "0001_init.sql"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Active project
	activeProj, err := storage.CreateProject(db, storage.Project{
		Name:     "Active Service",
		URL:      "https://active.example.com",
		IsActive: true,
	})
	if err != nil {
		t.Fatal(err)
	}

	// Inactive project (should be excluded)
	_, err = storage.CreateProject(db, storage.Project{
		Name:     "Inactive Service",
		URL:      "https://inactive.example.com",
		IsActive: false,
	})
	if err != nil {
		t.Fatal(err)
	}

	fixedNow := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	origNow := uptimeNowFunc
	uptimeNowFunc = func() time.Time { return fixedNow }
	defer func() { uptimeNowFunc = origNow }()

	// Window is 24h ending at 12:00:00 (so start is 2026-11-03 12:00:00)
	// Window has 60 buckets, each 24 minutes.
	// Bucket 0: 2026-11-03 12:00 to 12:24 -> EMPTY (no checks) -> status: "no_data"
	// Bucket 1: 2026-11-03 12:24 to 12:48 -> ALL-UP -> status: "up"
	// Bucket 2: 2026-11-03 12:48 to 13:12 -> ALL-DOWN -> status: "down"
	// Bucket 3: 2026-11-03 13:12 to 13:36 -> MIXED -> status: "degraded"

	windowStart := fixedNow.Add(-24 * time.Hour)

	// Bucket 1: all-up (2 successful checks)
	storage.InsertCheck(db, storage.Check{ProjectID: activeProj.ID, CheckedAt: windowStart.Add(25 * time.Minute), IsUp: true})
	storage.InsertCheck(db, storage.Check{ProjectID: activeProj.ID, CheckedAt: windowStart.Add(35 * time.Minute), IsUp: true})

	// Bucket 2: all-down (2 failed checks)
	storage.InsertCheck(db, storage.Check{ProjectID: activeProj.ID, CheckedAt: windowStart.Add(50 * time.Minute), IsUp: false})
	storage.InsertCheck(db, storage.Check{ProjectID: activeProj.ID, CheckedAt: windowStart.Add(55 * time.Minute), IsUp: false})

	// Bucket 3: mixed (1 up, 1 down -> 2 checks, 1 failed)
	storage.InsertCheck(db, storage.Check{ProjectID: activeProj.ID, CheckedAt: windowStart.Add(75 * time.Minute), IsUp: true})
	storage.InsertCheck(db, storage.Check{ProjectID: activeProj.ID, CheckedAt: windowStart.Add(80 * time.Minute), IsUp: false})

	r := NewRouter(db, "")
	req := httptest.NewRequest(http.MethodGet, "/api/uptime?window=24h&buckets=60", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var results []projectUptimeResponse
	if err := json.NewDecoder(rec.Body).Decode(&results); err != nil {
		t.Fatal(err)
	}

	// Only 1 active project should be returned
	if len(results) != 1 {
		t.Fatalf("expected 1 active project, got %d", len(results))
	}

	res := results[0]
	if res.ProjectID != activeProj.ID {
		t.Fatalf("expected project_id %d, got %d", activeProj.ID, res.ProjectID)
	}

	// Total checks: 2 (b1) + 2 (b2) + 2 (b3) = 6 checks.
	// Total passed: 2 + 0 + 1 = 3 checks.
	// Uptime percent: 3 / 6 * 100 = 50.0%
	if res.UptimePercent != 50.0 {
		t.Fatalf("expected uptime_percent 50.0, got %f", res.UptimePercent)
	}

	if len(res.Buckets) != 60 {
		t.Fatalf("expected 60 buckets, got %d", len(res.Buckets))
	}

	// 1. Empty bucket (Bucket 0)
	b0 := res.Buckets[0]
	if b0.Status != "no_data" || b0.Checks != 0 || b0.Failed != 0 {
		t.Fatalf("expected bucket 0 to be no_data with 0 checks, got %+v", b0)
	}
	if b0.Start != windowStart.Format(time.RFC3339) {
		t.Fatalf("unexpected start time for bucket 0: %s", b0.Start)
	}
	if b0.End != windowStart.Add(24*time.Minute).Format(time.RFC3339) {
		t.Fatalf("unexpected end time for bucket 0: %s", b0.End)
	}

	// 2. All-up bucket (Bucket 1)
	b1 := res.Buckets[1]
	if b1.Status != "up" || b1.Checks != 2 || b1.Failed != 0 {
		t.Fatalf("expected bucket 1 to be up with 2 checks and 0 failed, got %+v", b1)
	}

	// 3. All-down bucket (Bucket 2)
	b2 := res.Buckets[2]
	if b2.Status != "down" || b2.Checks != 2 || b2.Failed != 2 {
		t.Fatalf("expected bucket 2 to be down with 2 checks and 2 failed, got %+v", b2)
	}

	// 4. Mixed bucket (Bucket 3)
	b3 := res.Buckets[3]
	if b3.Status != "degraded" || b3.Checks != 2 || b3.Failed != 1 {
		t.Fatalf("expected bucket 3 to be degraded with 2 checks and 1 failed, got %+v", b3)
	}
}
