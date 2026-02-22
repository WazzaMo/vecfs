// Package storage manages VecFS JSONL file storage: store, search, updateScore, delete.
// Matches ts-src/storage.ts behaviour.
package storage

import (
	"bufio"
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/WazzaMo/vecfs/internal/sparse"
)

const feedbackRankWeight = 0.1

// VecFSEntry is a single stored entry (matches TS VecFSEntry).
type VecFSEntry struct {
	ID        string            `json:"id"`
	Metadata  map[string]any    `json:"metadata"`
	Vector    sparse.Vector     `json:"vector"`
	Score     float64           `json:"score"`
	Timestamp int64             `json:"timestamp"`
}

// SearchResult extends an entry with similarity (matches TS SearchResult).
type SearchResult struct {
	VecFSEntry
	Similarity float64 `json:"similarity"`
}

// Storage manages a JSONL file with mutex-protected access.
type Storage struct {
	filePath    string
	entries     []*VecFSEntry
	initialized  bool
	mu          sync.Mutex
}

// New creates a Storage that uses the given file path.
func New(filePath string) *Storage {
	return &Storage{filePath: filePath}
}

func feedbackBoost(score float64) float64 {
	abs := score
	if abs < 0 {
		abs = -abs
	}
	return feedbackRankWeight * (score / (1 + abs))
}

func combinedRank(similarity, score float64) float64 {
	return similarity + feedbackBoost(score)
}

func (s *Storage) ensureFileUnlocked() error {
	if s.initialized {
		return nil
	}
	dir := filepath.Dir(s.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		if err := os.WriteFile(s.filePath, nil, 0644); err != nil {
			return err
		}
	}
	s.initialized = true
	return nil
}

// EnsureFile creates the file and parent dir if needed. Safe to call multiple times.
func (s *Storage) EnsureFile() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.ensureFileUnlocked()
}

func (s *Storage) loadEntriesLocked() ([]*VecFSEntry, error) {
	if s.entries != nil {
		return s.entries, nil
	}
	if err := s.ensureFileUnlocked(); err != nil {
		return nil, err
	}
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return nil, err
	}
	var entries []*VecFSEntry
	scanner := bufio.NewScanner(bufio.NewReader(bytes.NewReader(data)))
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var e VecFSEntry
		if err := json.Unmarshal(line, &e); err != nil {
			continue // skip malformed
		}
		entries = append(entries, &e)
	}
	s.entries = entries
	return s.entries, nil
}

func (s *Storage) persistAllLocked(entries []*VecFSEntry) error {
	var buf []byte
	for _, e := range entries {
		line, err := json.Marshal(e)
		if err != nil {
			return err
		}
		buf = append(buf, line...)
		buf = append(buf, '\n')
	}
	return os.WriteFile(s.filePath, buf, 0644)
}

func (s *Storage) persistAppendLocked(entry *VecFSEntry) error {
	f, err := os.OpenFile(s.filePath, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	line, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = f.Write(append(line, '\n'))
	return err
}

// Store upserts an entry. Returns true if new, false if updated.
func (s *Storage) Store(entry *VecFSEntry) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entries, err := s.loadEntriesLocked()
	if err != nil {
		return false, err
	}
	full := *entry
	if full.Timestamp == 0 {
		full.Timestamp = nowMs()
	}
	for i, e := range entries {
		if e.ID == entry.ID {
			entries[i] = &full
			return false, s.persistAllLocked(entries)
		}
	}
	entries = append(entries, &full)
	s.entries = entries
	return true, s.persistAppendLocked(&full)
}

// Search returns entries sorted by combined rank (similarity + feedback boost), limited.
func (s *Storage) Search(query sparse.Vector, limit int) ([]*SearchResult, error) {
	s.mu.Lock()
	entries, err := s.loadEntriesLocked()
	s.mu.Unlock()
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 5
	}
	queryNorm := sparse.Norm(query)
	results := make([]*SearchResult, 0, len(entries))
	for _, e := range entries {
		sim := sparse.CosineSimilarity(query, e.Vector, queryNorm)
		results = append(results, &SearchResult{VecFSEntry: *e, Similarity: sim})
	}
	// Sort by combined rank descending
	sortSearchResults(results)
	if len(results) > limit {
		results = results[:limit]
	}
	return results, nil
}

func sortSearchResults(r []*SearchResult) {
	// Simple sort by combined rank desc
	for i := 0; i < len(r); i++ {
		for j := i + 1; j < len(r); j++ {
			ci := combinedRank(r[i].Similarity, r[i].Score)
			cj := combinedRank(r[j].Similarity, r[j].Score)
			if cj > ci {
				r[i], r[j] = r[j], r[i]
			}
		}
	}
}

// UpdateScore adjusts the score of an entry by ID. Returns true if found.
func (s *Storage) UpdateScore(id string, delta float64) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entries, err := s.loadEntriesLocked()
	if err != nil {
		return false, err
	}
	for _, e := range entries {
		if e.ID == id {
			e.Score += delta
			return true, s.persistAllLocked(entries)
		}
	}
	return false, nil
}

// Delete removes an entry by ID. Returns true if found.
func (s *Storage) Delete(id string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entries, err := s.loadEntriesLocked()
	if err != nil {
		return false, err
	}
	for i, e := range entries {
		if e.ID == id {
			entries = append(entries[:i], entries[i+1:]...)
			s.entries = entries
			return true, s.persistAllLocked(entries)
		}
	}
	return false, nil
}

func nowMs() int64 { return time.Now().UnixMilli() }
