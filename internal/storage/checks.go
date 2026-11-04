package storage

import (
	"database/sql"
	"time"
)

type Check struct {
	ID             int64     `json:"id"`
	ProjectID      int64     `json:"project_id"`
	CheckedAt      time.Time `json:"checked_at"`
	IsUp           bool      `json:"is_up"`
	StatusCode     *int      `json:"status_code"`
	ResponseTimeMS *int      `json:"response_time_ms"`
	ErrorMessage   *string   `json:"error_message"`
}

func InsertCheck(db *sql.DB, check Check) (Check, error) {
	var result sql.Result
	var err error
	if check.CheckedAt.IsZero() {
		result, err = db.Exec(`
			INSERT INTO checks (project_id, is_up, status_code, response_time_ms, error_message)
			VALUES (?, ?, ?, ?, ?)`, check.ProjectID, check.IsUp, check.StatusCode,
			check.ResponseTimeMS, check.ErrorMessage)
	} else {
		result, err = db.Exec(`
			INSERT INTO checks (project_id, checked_at, is_up, status_code, response_time_ms, error_message)
			VALUES (?, ?, ?, ?, ?, ?)`, check.ProjectID, check.CheckedAt, check.IsUp,
			check.StatusCode, check.ResponseTimeMS, check.ErrorMessage)
	}
	if err != nil {
		return Check{}, err
	}

	check.ID, err = result.LastInsertId()
	if err != nil {
		return Check{}, err
	}
	return getCheck(db, check.ID)
}

func GetChecksByProject(db *sql.DB, projectID int64, since time.Time) ([]Check, error) {
	rows, err := db.Query(`
		SELECT id, project_id, checked_at, is_up, status_code, response_time_ms, error_message
		FROM checks
		WHERE project_id = ? AND checked_at >= ?
		ORDER BY checked_at, id`, projectID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var checks []Check
	for rows.Next() {
		check, err := scanCheck(rows)
		if err != nil {
			return nil, err
		}
		checks = append(checks, check)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return checks, nil
}

func getCheck(db *sql.DB, id int64) (Check, error) {
	return scanCheck(db.QueryRow(`
		SELECT id, project_id, checked_at, is_up, status_code, response_time_ms, error_message
		FROM checks WHERE id = ?`, id))
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanCheck(row rowScanner) (Check, error) {
	var check Check
	var statusCode, responseTime sql.NullInt64
	var errorMessage sql.NullString
	err := row.Scan(&check.ID, &check.ProjectID, &check.CheckedAt, &check.IsUp,
		&statusCode, &responseTime, &errorMessage)
	if err != nil {
		return Check{}, err
	}
	if statusCode.Valid {
		value := int(statusCode.Int64)
		check.StatusCode = &value
	}
	if responseTime.Valid {
		value := int(responseTime.Int64)
		check.ResponseTimeMS = &value
	}
	if errorMessage.Valid {
		check.ErrorMessage = &errorMessage.String
	}
	return check, nil
}

type BucketStat struct {
	BucketIndex  int
	TotalChecks  int
	FailedChecks int
}

func GetCheckBucketStats(db *sql.DB, projectID int64, start, end time.Time, bucketCount int) ([]BucketStat, error) {
	windowDuration := end.Sub(start)
	bucketSeconds := windowDuration.Seconds() / float64(bucketCount)
	startUnix := start.Unix()

	rows, err := db.Query(`
		SELECT
			MIN(? - 1, MAX(0, CAST((strftime('%s', substr(checked_at, 1, 19)) - ?) / ? AS INTEGER))) AS bucket_idx,
			COUNT(*),
			COALESCE(SUM(CASE WHEN is_up = 0 THEN 1 ELSE 0 END), 0)
		FROM checks
		WHERE project_id = ? AND checked_at >= ? AND checked_at <= ?
		GROUP BY bucket_idx
		ORDER BY bucket_idx`,
		bucketCount, startUnix, bucketSeconds, projectID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []BucketStat
	for rows.Next() {
		var s BucketStat
		if err := rows.Scan(&s.BucketIndex, &s.TotalChecks, &s.FailedChecks); err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return stats, nil
}

