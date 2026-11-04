package storage

import (
	"database/sql"
	"time"
)

type Project struct {
	ID                   int64     `json:"id"`
	Name                 string    `json:"name"`
	URL                  string    `json:"url"`
	CloudflareZoneID     *string   `json:"cloudflare_zone_id"`
	CloudflareAccountID  *string   `json:"cloudflare_account_id"`
	CloudflareWorkerName *string   `json:"cloudflare_worker_name"`
	CheckIntervalSeconds int       `json:"check_interval_seconds"`
	FailureThreshold     int       `json:"failure_threshold"`
	IsActive             bool      `json:"is_active"`
	CreatedAt            time.Time `json:"created_at"`
}

func (p Project) Threshold(fallback int) int {
	if p.FailureThreshold > 0 {
		return p.FailureThreshold
	}
	if fallback > 0 {
		return fallback
	}
	return 3
}

func CreateProject(db *sql.DB, project Project) (Project, error) {
	result, err := db.Exec(`
		INSERT INTO projects (name, url, cloudflare_zone_id, cloudflare_account_id, cloudflare_worker_name, check_interval_seconds, failure_threshold, is_active)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, project.Name, project.URL, project.CloudflareZoneID,
		project.CloudflareAccountID, project.CloudflareWorkerName,
		project.CheckIntervalSeconds, project.FailureThreshold, project.IsActive)
	if err != nil {
		return Project{}, err
	}

	project.ID, err = result.LastInsertId()
	if err != nil {
		return Project{}, err
	}
	return GetProject(db, project.ID)
}

func GetProject(db *sql.DB, id int64) (Project, error) {
	var project Project
	var zoneID, accountID, workerName sql.NullString
	var threshold sql.NullInt64
	err := db.QueryRow(`
		SELECT id, name, url, cloudflare_zone_id, cloudflare_account_id, cloudflare_worker_name, check_interval_seconds, failure_threshold, is_active, created_at
		FROM projects WHERE id = ?`, id).Scan(
		&project.ID, &project.Name, &project.URL, &zoneID, &accountID, &workerName,
		&project.CheckIntervalSeconds, &threshold, &project.IsActive, &project.CreatedAt)
	if err != nil {
		return Project{}, err
	}
	if zoneID.Valid {
		project.CloudflareZoneID = &zoneID.String
	}
	if accountID.Valid {
		project.CloudflareAccountID = &accountID.String
	}
	if workerName.Valid {
		project.CloudflareWorkerName = &workerName.String
	}
	if threshold.Valid {
		project.FailureThreshold = int(threshold.Int64)
	}
	return project, nil
}

func ListProjects(db *sql.DB) ([]Project, error) {
	rows, err := db.Query(`
		SELECT id, name, url, cloudflare_zone_id, cloudflare_account_id, cloudflare_worker_name, check_interval_seconds, failure_threshold, is_active, created_at
		FROM projects ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var project Project
		var zoneID, accountID, workerName sql.NullString
		var threshold sql.NullInt64
		if err := rows.Scan(&project.ID, &project.Name, &project.URL, &zoneID, &accountID, &workerName,
			&project.CheckIntervalSeconds, &threshold, &project.IsActive, &project.CreatedAt); err != nil {
			return nil, err
		}
		if zoneID.Valid {
			project.CloudflareZoneID = &zoneID.String
		}
		if accountID.Valid {
			project.CloudflareAccountID = &accountID.String
		}
		if workerName.Valid {
			project.CloudflareWorkerName = &workerName.String
		}
		if threshold.Valid {
			project.FailureThreshold = int(threshold.Int64)
		}
		projects = append(projects, project)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return projects, nil
}

func UpdateProject(db *sql.DB, project Project) error {
	result, err := db.Exec(`
		UPDATE projects
		SET name = ?, url = ?, cloudflare_zone_id = ?, cloudflare_account_id = ?, cloudflare_worker_name = ?, check_interval_seconds = ?, failure_threshold = ?, is_active = ?
		WHERE id = ?`, project.Name, project.URL, project.CloudflareZoneID,
		project.CloudflareAccountID, project.CloudflareWorkerName,
		project.CheckIntervalSeconds, project.FailureThreshold, project.IsActive, project.ID)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}
