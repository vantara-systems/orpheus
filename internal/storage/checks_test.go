package storage

import (
	"path/filepath"
	"testing"
	"time"
)

func TestCheckStorage(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "orpheus.db"), filepath.Join("..", "..", "migrations", "0001_init.sql"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	project, err := CreateProject(db, Project{Name: "Example", URL: "https://example.com", CheckIntervalSeconds: 60, IsActive: true})
	if err != nil {
		t.Fatal(err)
	}
	statusCode, responseTime := 200, 42
	message := "connection failed"
	firstTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	first, err := InsertCheck(db, Check{
		ProjectID:      project.ID,
		CheckedAt:      firstTime,
		IsUp:           true,
		StatusCode:     &statusCode,
		ResponseTimeMS: &responseTime,
	})
	if err != nil {
		t.Fatal(err)
	}
	if first.ID == 0 || !first.CheckedAt.Equal(firstTime) || first.StatusCode == nil || *first.StatusCode != 200 {
		t.Fatalf("unexpected inserted check: %+v", first)
	}

	secondTime := firstTime.Add(time.Hour)
	if _, err := InsertCheck(db, Check{ProjectID: project.ID, CheckedAt: secondTime, ErrorMessage: &message}); err != nil {
		t.Fatal(err)
	}
	checks, err := GetChecksByProject(db, project.ID, firstTime.Add(30*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if len(checks) != 1 || checks[0].CheckedAt.Before(secondTime) || checks[0].ErrorMessage == nil {
		t.Fatalf("unexpected filtered checks: %+v", checks)
	}
}

func TestGetCheckBucketStats(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "orpheus.db"), filepath.Join("..", "..", "migrations", "0001_init.sql"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	project, err := CreateProject(db, Project{Name: "Example", URL: "https://example.com", CheckIntervalSeconds: 60, IsActive: true})
	if err != nil {
		t.Fatal(err)
	}

	baseTime := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	windowEnd := baseTime.Add(24 * time.Hour)

	// Check plan uses idx_checks_project_time
	var id, selectID, order int
	var detail string
	err = db.QueryRow(`
		EXPLAIN QUERY PLAN
		SELECT
			MIN(? - 1, MAX(0, CAST((strftime('%s', substr(checked_at, 1, 19)) - ?) / ? AS INTEGER))) AS bucket_idx,
			COUNT(*),
			COALESCE(SUM(CASE WHEN is_up = 0 THEN 1 ELSE 0 END), 0)
		FROM checks
		WHERE project_id = ? AND checked_at >= ? AND checked_at <= ?
		GROUP BY bucket_idx`, 60, baseTime.Unix(), 1440.0, project.ID, baseTime, windowEnd).Scan(&id, &selectID, &order, &detail)
	if err != nil {
		t.Fatalf("explain query plan failed: %v", err)
	}
	t.Logf("Query plan: %s", detail)

	// Bucket 0 (12:00 to 12:24) -> 2 checks, both up
	InsertCheck(db, Check{ProjectID: project.ID, CheckedAt: baseTime.Add(2 * time.Minute), IsUp: true})
	InsertCheck(db, Check{ProjectID: project.ID, CheckedAt: baseTime.Add(10 * time.Minute), IsUp: true})

	// Bucket 1 (12:24 to 12:48) -> 2 checks, both down
	InsertCheck(db, Check{ProjectID: project.ID, CheckedAt: baseTime.Add(25 * time.Minute), IsUp: false})
	InsertCheck(db, Check{ProjectID: project.ID, CheckedAt: baseTime.Add(30 * time.Minute), IsUp: false})

	// Bucket 2 (12:48 to 13:12) -> 3 checks, 1 down, 2 up (mixed)
	InsertCheck(db, Check{ProjectID: project.ID, CheckedAt: baseTime.Add(50 * time.Minute), IsUp: true})
	InsertCheck(db, Check{ProjectID: project.ID, CheckedAt: baseTime.Add(55 * time.Minute), IsUp: false})
	InsertCheck(db, Check{ProjectID: project.ID, CheckedAt: baseTime.Add(60 * time.Minute), IsUp: true})

	stats, err := GetCheckBucketStats(db, project.ID, baseTime, windowEnd, 60)
	if err != nil {
		t.Fatalf("GetCheckBucketStats failed: %v", err)
	}

	if len(stats) != 3 {
		t.Fatalf("expected 3 bucket stats, got %d: %+v", len(stats), stats)
	}

	if stats[0].BucketIndex != 0 || stats[0].TotalChecks != 2 || stats[0].FailedChecks != 0 {
		t.Fatalf("unexpected bucket 0 stats: %+v", stats[0])
	}
	if stats[1].BucketIndex != 1 || stats[1].TotalChecks != 2 || stats[1].FailedChecks != 2 {
		t.Fatalf("unexpected bucket 1 stats: %+v", stats[1])
	}
	if stats[2].BucketIndex != 2 || stats[2].TotalChecks != 3 || stats[2].FailedChecks != 1 {
		t.Fatalf("unexpected bucket 2 stats: %+v", stats[2])
	}
}

