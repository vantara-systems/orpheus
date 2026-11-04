package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

var (
	cloudflareZonesEndpoint    = "https://api.cloudflare.com/client/v4/zones"
	cloudflareAccountsEndpoint = "https://api.cloudflare.com/client/v4/accounts"
)

type cloudflareWorker struct {
	AccountID   string `json:"account_id"`
	AccountName string `json:"account_name"`
	Name        string `json:"name"`
	URL         string `json:"url"`
}

type cloudflareZone struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

type cloudflareZonesResponse struct {
	Success bool `json:"success"`
	Errors  []struct {
		Message string `json:"message"`
	}
	Result     []cloudflareZone `json:"result"`
	ResultInfo struct {
		TotalPages int `json:"total_pages"`
	} `json:"result_info"`
}

func handleCloudflareZones(token string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if token == "" {
			http.Error(w, "CLOUDFLARE_API_TOKEN belum dikonfigurasi", http.StatusServiceUnavailable)
			return
		}
		zones, err := fetchCloudflareZones(token)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"zones": zones})
	}
}

func handleCloudflareWorkers(token string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if token == "" {
			http.Error(w, "CLOUDFLARE_API_TOKEN belum dikonfigurasi", http.StatusServiceUnavailable)
			return
		}
		workers, err := fetchCloudflareWorkers(token)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"workers": workers})
	}
}

func fetchCloudflareWorkers(token string) ([]cloudflareWorker, error) {
	var accounts []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := cloudflareGet(token, cloudflareAccountsEndpoint+"?per_page=50", &accounts); err != nil {
		return nil, err
	}
	workers := make([]cloudflareWorker, 0)
	for _, account := range accounts {
		var subdomain struct {
			Subdomain string `json:"subdomain"`
		}
		// workers.dev may be disabled; the import form lets the URL be edited.
		_ = cloudflareGet(token, fmt.Sprintf("%s/%s/workers/subdomain", cloudflareAccountsEndpoint, account.ID), &subdomain)
		var scripts []struct {
			ID string `json:"id"`
		}
		if err := cloudflareGet(token, fmt.Sprintf("%s/%s/workers/scripts", cloudflareAccountsEndpoint, account.ID), &scripts); err != nil {
			return nil, err
		}
		for _, script := range scripts {
			url := ""
			if subdomain.Subdomain != "" {
				url = fmt.Sprintf("https://%s.%s.workers.dev/", script.ID, subdomain.Subdomain)
			}
			workers = append(workers, cloudflareWorker{
				AccountID:   account.ID,
				AccountName: account.Name,
				Name:        script.ID,
				URL:         url,
			})
		}
	}
	return workers, nil
}

func cloudflareGet(token, endpoint string, result any) error {
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var body struct {
		Success bool `json:"success"`
		Errors  []struct {
			Message string `json:"message"`
		} `json:"errors"`
		Result json.RawMessage `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return err
	}
	if resp.StatusCode >= http.StatusBadRequest || !body.Success {
		if len(body.Errors) > 0 {
			return fmt.Errorf("cloudflare: %s", body.Errors[0].Message)
		}
		return fmt.Errorf("cloudflare API returned %s", resp.Status)
	}
	return json.Unmarshal(body.Result, result)
}

func fetchCloudflareZones(token string) ([]cloudflareZone, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	zones := make([]cloudflareZone, 0)
	for page := 1; ; page++ {
		req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s?per_page=50&page=%d", cloudflareZonesEndpoint, page), nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		var body cloudflareZonesResponse
		err = json.NewDecoder(resp.Body).Decode(&body)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}
		if resp.StatusCode >= http.StatusBadRequest || !body.Success {
			if len(body.Errors) > 0 {
				return nil, fmt.Errorf("cloudflare: %s", body.Errors[0].Message)
			}
			return nil, fmt.Errorf("cloudflare API returned %s", resp.Status)
		}
		zones = append(zones, body.Result...)
		if page >= body.ResultInfo.TotalPages || len(body.Result) == 0 {
			return zones, nil
		}
	}
}
