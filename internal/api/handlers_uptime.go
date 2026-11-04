package api

import (
	"database/sql"
	"encoding/json"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/hiroshiyoka/orpheus/internal/storage"
)

var uptimeNowFunc = func() time.Time {
	return time.Now().UTC()
}

type bucketResponse struct {
	Start  string `json:"start"`
	End    string `json:"end"`
	Status string `json:"status"`
	Checks int    `json:"checks"`
	Failed int    `json:"failed"`
}

type projectUptimeResponse struct {
	ProjectID     int64            `json:"project_id"`
	UptimePercent float64          `json:"uptime_percent"`
	Buckets       []bucketResponse `json:"buckets"`
}

func handleUptime(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/uptime" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		windowParam := r.URL.Query().Get("window")
		if windowParam == "" {
			windowParam = "24h"
		}
		var windowDuration time.Duration
		switch windowParam {
		case "24h":
			windowDuration = 24 * time.Hour
		case "7d":
			windowDuration = 7 * 24 * time.Hour
		default:
			http.Error(w, "invalid window", http.StatusBadRequest)
			return
		}

		bucketsParam := r.URL.Query().Get("buckets")
		buckets := 60
		if bucketsParam != "" {
			b, err := strconv.Atoi(bucketsParam)
			if err != nil {
				http.Error(w, "invalid buckets", http.StatusBadRequest)
				return
			}
			buckets = b
		}
		if buckets < 1 {
			buckets = 1
		} else if buckets > 120 {
			buckets = 120
		}

		projects, err := storage.ListProjects(db)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		now := uptimeNowFunc()
		windowStart := now.Add(-windowDuration)
		windowEnd := now
		bucketDuration := windowDuration / time.Duration(buckets)

		responses := make([]projectUptimeResponse, 0)
		for _, p := range projects {
			if !p.IsActive {
				continue
			}

			bucketList := make([]bucketResponse, buckets)
			for i := 0; i < buckets; i++ {
				bStart := windowStart.Add(time.Duration(i) * bucketDuration)
				bEnd := windowStart.Add(time.Duration(i+1) * bucketDuration)
				if i == buckets-1 {
					bEnd = windowEnd
				}
				bucketList[i] = bucketResponse{
					Start:  bStart.Format(time.RFC3339),
					End:    bEnd.Format(time.RFC3339),
					Status: "no_data",
					Checks: 0,
					Failed: 0,
				}
			}

			stats, err := storage.GetCheckBucketStats(db, p.ID, windowStart, windowEnd, buckets)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			totalChecks := 0
			totalFailed := 0
			for _, s := range stats {
				if s.BucketIndex >= 0 && s.BucketIndex < buckets {
					bucketList[s.BucketIndex].Checks = s.TotalChecks
					bucketList[s.BucketIndex].Failed = s.FailedChecks

					if s.TotalChecks == 0 {
						bucketList[s.BucketIndex].Status = "no_data"
					} else if s.FailedChecks == s.TotalChecks {
						bucketList[s.BucketIndex].Status = "down"
					} else if s.FailedChecks > 0 {
						bucketList[s.BucketIndex].Status = "degraded"
					} else {
						bucketList[s.BucketIndex].Status = "up"
					}

					totalChecks += s.TotalChecks
					totalFailed += s.FailedChecks
				}
			}

			uptime := 100.0
			if totalChecks > 0 {
				uptime = math.Round((float64(totalChecks-totalFailed)/float64(totalChecks))*1000) / 10
			}

			responses = append(responses, projectUptimeResponse{
				ProjectID:     p.ID,
				UptimePercent: uptime,
				Buckets:       bucketList,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(responses)
	}
}
