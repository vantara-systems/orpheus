package collector

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/hiroshiyoka/orpheus/internal/alerting"
	"github.com/hiroshiyoka/orpheus/internal/detector"
	"github.com/hiroshiyoka/orpheus/internal/storage"
)

type Pinger func(url string, timeout time.Duration) storage.Check
type AlertSender func(botToken, chatID, message string) error

func Start(ctx context.Context, db *sql.DB, projects []storage.Project, ping Pinger, failureThreshold int, botToken, chatID string, sendAlert AlertSender) {
	if sendAlert == nil {
		sendAlert = alerting.SendTelegramAlert
	}
	var wg sync.WaitGroup
	for _, project := range projects {
		if !project.IsActive {
			continue
		}
		wg.Add(1)
		go func(p storage.Project) {
			defer wg.Done()
			runProject(ctx, db, p, ping, failureThreshold, botToken, chatID, sendAlert)
		}(project)
	}
	wg.Wait()
}

// Run keeps the scheduled projects in sync with the database. Projects added,
// edited, or deactivated through the API take effect within one reload interval
// without restarting the server.
func Run(ctx context.Context, db *sql.DB, ping Pinger, failureThreshold int, botToken, chatID string, sendAlert AlertSender, reload time.Duration) {
	if sendAlert == nil {
		sendAlert = alerting.SendTelegramAlert
	}
	if reload <= 0 {
		reload = 30 * time.Second
	}
	type worker struct {
		project storage.Project
		cancel  context.CancelFunc
	}
	running := map[int64]worker{}
	defer func() {
		for _, w := range running {
			w.cancel()
		}
	}()

	reconcile := func() {
		projects, err := storage.ListProjects(db)
		if err != nil {
			log.Printf("project reload failed: %v", err)
			return
		}
		desired := make(map[int64]storage.Project, len(projects))
		for _, p := range projects {
			if p.IsActive {
				desired[p.ID] = p
			}
		}
		for id, w := range running {
			p, ok := desired[id]
			if !ok || !sameProject(w.project, p) {
				w.cancel()
				delete(running, id)
			}
		}
		for id, p := range desired {
			if _, ok := running[id]; ok {
				continue
			}
			pctx, cancel := context.WithCancel(ctx)
			running[id] = worker{project: p, cancel: cancel}
			go runProject(pctx, db, p, ping, failureThreshold, botToken, chatID, sendAlert)
		}
	}

	reconcile()
	ticker := time.NewTicker(reload)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			reconcile()
		}
	}
}

func sameProject(a, b storage.Project) bool {
	return a.Name == b.Name &&
		a.URL == b.URL &&
		a.CheckIntervalSeconds == b.CheckIntervalSeconds &&
		a.FailureThreshold == b.FailureThreshold
}

func runProject(ctx context.Context, db *sql.DB, p storage.Project, ping Pinger, failureThreshold int, botToken, chatID string, sendAlert AlertSender) {
	interval := p.CheckIntervalSeconds
	if interval <= 0 {
		interval = 60
	}
	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()
	store := func() {
		check := ping(p.URL, 10*time.Second)
		check.ProjectID = p.ID
		saved, err := storage.InsertCheck(db, check)
		if err != nil {
			log.Printf("check insert failed: %v", err)
			return
		}
		n := p.Threshold(failureThreshold)
		if !saved.IsUp {
			incident, err := detector.CheckDowntime(db, p.ID, n)
			if err != nil {
				log.Printf("downtime check failed: %v", err)
			} else if incident != nil {
				message := fmt.Sprintf("[%s] Down\nURL: %s", p.Name, p.URL)
				sent, err := storage.AlertSent(db, incident.ID, "telegram", message)
				if err != nil {
					log.Printf("alert lookup failed: %v", err)
				} else if !sent {
					if err := sendAlert(botToken, chatID, message); err != nil {
						log.Printf("telegram alert failed: %v", err)
					} else if err := storage.InsertAlert(db, incident.ID, "telegram", message); err != nil {
						log.Printf("alert log failed: %v", err)
					}
				}
			}
		} else {
			incident, err := detector.ResolveDowntime(db, p.ID, true)
			if err != nil {
				log.Printf("resolve check failed: %v", err)
			} else if incident != nil {
				message := fmt.Sprintf("[%s] Recovered\nURL: %s", p.Name, p.URL)
				sent, err := storage.AlertSent(db, incident.ID, "telegram", message)
				if err != nil {
					log.Printf("alert lookup failed: %v", err)
				} else if !sent {
					if err := sendAlert(botToken, chatID, message); err != nil {
						log.Printf("telegram alert failed: %v", err)
					} else if err := storage.InsertAlert(db, incident.ID, "telegram", message); err != nil {
						log.Printf("alert log failed: %v", err)
					}
				}
			}
		}
	}
	store()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			store()
		}
	}
}
