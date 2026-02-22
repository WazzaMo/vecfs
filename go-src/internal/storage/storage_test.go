package storage

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/WazzaMo/vecfs/internal/sparse"
)

// Tests match ts-src/storage.test.ts cases.

func testPath(t *testing.T) string {
	dir := t.TempDir()
	return filepath.Join(dir, "test-storage.jsonl")
}

func TestEnsureFile(t *testing.T) {
	p := testPath(t)
	st := New(p)
	if err := st.EnsureFile(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(p); os.IsNotExist(err) {
		t.Error("file was not created")
	}
}

func TestStoreAndSearch(t *testing.T) {
	st := New(testPath(t))
	if err := st.EnsureFile(); err != nil {
		t.Fatal(err)
	}
	entry := &VecFSEntry{
		ID:       "1",
		Vector:   sparse.Vector{"0": 1},
		Metadata: map[string]any{"text": "test"},
		Score:    0,
	}
	_, err := st.Store(entry)
	if err != nil {
		t.Fatal(err)
	}
	results, err := st.Search(sparse.Vector{"0": 1}, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 || results[0].ID != "1" || results[0].Similarity != 1 {
		t.Errorf("results = %+v", results)
	}
}

func TestUpdateScores(t *testing.T) {
	st := New(testPath(t))
	if err := st.EnsureFile(); err != nil {
		t.Fatal(err)
	}
	_, _ = st.Store(&VecFSEntry{ID: "1", Vector: sparse.Vector{"0": 1}, Metadata: map[string]any{}, Score: 10})
	found, err := st.UpdateScore("1", 5)
	if err != nil || !found {
		t.Fatal(err)
	}
	results, _ := st.Search(sparse.Vector{"0": 1}, 10)
	if len(results) == 0 || results[0].Score != 15 {
		t.Errorf("score = %v", results[0].Score)
	}
}

func TestSortBySimilarity(t *testing.T) {
	st := New(testPath(t))
	if err := st.EnsureFile(); err != nil {
		t.Fatal(err)
	}
	_, _ = st.Store(&VecFSEntry{ID: "1", Vector: sparse.Vector{"0": 1}, Metadata: map[string]any{}, Score: 0})
	_, _ = st.Store(&VecFSEntry{ID: "2", Vector: sparse.Vector{"0": 0.5}, Metadata: map[string]any{}, Score: 0})
	results, _ := st.Search(sparse.Vector{"0": 1}, 10)
	if results[0].ID != "1" || results[1].ID != "2" {
		t.Errorf("order = %v %v", results[0].ID, results[1].ID)
	}
}

func TestFeedbackBoostsRanking(t *testing.T) {
	st := New(testPath(t))
	if err := st.EnsureFile(); err != nil {
		t.Fatal(err)
	}
	v := sparse.Vector{"0": 1, "1": 0}
	_, _ = st.Store(&VecFSEntry{ID: "low-feedback", Vector: v, Metadata: map[string]any{}, Score: 0})
	_, _ = st.Store(&VecFSEntry{ID: "high-feedback", Vector: v, Metadata: map[string]any{}, Score: 10})
	results, _ := st.Search(sparse.Vector{"0": 1, "1": 0}, 10)
	if len(results) != 2 || results[0].ID != "high-feedback" || results[1].ID != "low-feedback" {
		t.Errorf("order = %v %v", results[0].ID, results[1].ID)
	}
}

func TestEmptyStore(t *testing.T) {
	st := New(testPath(t))
	if err := st.EnsureFile(); err != nil {
		t.Fatal(err)
	}
	results, _ := st.Search(sparse.Vector{"0": 1}, 10)
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestUpsertDuplicateID(t *testing.T) {
	st := New(testPath(t))
	if err := st.EnsureFile(); err != nil {
		t.Fatal(err)
	}
	isNew1, _ := st.Store(&VecFSEntry{ID: "dup", Vector: sparse.Vector{"0": 1}, Metadata: map[string]any{"version": "first"}, Score: 0})
	if !isNew1 {
		t.Error("expected true for first store")
	}
	isNew2, _ := st.Store(&VecFSEntry{ID: "dup", Vector: sparse.Vector{"0": 1}, Metadata: map[string]any{"version": "second"}, Score: 5})
	if isNew2 {
		t.Error("expected false for second store")
	}
	results, _ := st.Search(sparse.Vector{"0": 1}, 10)
	var dup *SearchResult
	for _, r := range results {
		if r.ID == "dup" {
			dup = r
			break
		}
	}
	if dup == nil || dup.Metadata["version"] != "second" || dup.Score != 5 {
		t.Errorf("dup = %+v", dup)
	}
}

func TestUpdateScoreNonexistent(t *testing.T) {
	st := New(testPath(t))
	if err := st.EnsureFile(); err != nil {
		t.Fatal(err)
	}
	found, _ := st.UpdateScore("nonexistent", 5)
	if found {
		t.Error("expected false")
	}
}

func TestDeleteExisting(t *testing.T) {
	st := New(testPath(t))
	if err := st.EnsureFile(); err != nil {
		t.Fatal(err)
	}
	_, _ = st.Store(&VecFSEntry{ID: "to-delete", Vector: sparse.Vector{"0": 1}, Metadata: map[string]any{}, Score: 0})
	deleted, _ := st.Delete("to-delete")
	if !deleted {
		t.Fatal("expected true")
	}
	results, _ := st.Search(sparse.Vector{"0": 1}, 10)
	for _, r := range results {
		if r.ID == "to-delete" {
			t.Error("entry should be gone")
		}
	}
}

func TestDeleteNonexistent(t *testing.T) {
	st := New(testPath(t))
	if err := st.EnsureFile(); err != nil {
		t.Fatal(err)
	}
	deleted, _ := st.Delete("nonexistent")
	if deleted {
		t.Error("expected false")
	}
}

func TestConcurrentUpdateScore(t *testing.T) {
	st := New(testPath(t))
	if err := st.EnsureFile(); err != nil {
		t.Fatal(err)
	}
	_, _ = st.Store(&VecFSEntry{ID: "concurrent", Vector: sparse.Vector{"0": 1}, Metadata: map[string]any{}, Score: 0})
	done := make(chan struct{})
	for i := 0; i < 10; i++ {
		go func() {
			st.UpdateScore("concurrent", 1)
			done <- struct{}{}
		}()
	}
	for i := 0; i < 10; i++ {
		<-done
	}
	results, _ := st.Search(sparse.Vector{"0": 1}, 10)
	var ent *SearchResult
	for _, r := range results {
		if r.ID == "concurrent" {
			ent = r
			break
		}
	}
	if ent == nil || ent.Score != 10 {
		t.Errorf("score = %v", ent)
	}
}

func TestPersistAfterDelete(t *testing.T) {
	p := testPath(t)
	st := New(p)
	if err := st.EnsureFile(); err != nil {
		t.Fatal(err)
	}
	_, _ = st.Store(&VecFSEntry{ID: "keep", Vector: sparse.Vector{"0": 1}, Metadata: map[string]any{}, Score: 0})
	_, _ = st.Store(&VecFSEntry{ID: "remove", Vector: sparse.Vector{"1": 1}, Metadata: map[string]any{}, Score: 0})
	_, _ = st.Delete("remove")
	st2 := New(p)
	results, _ := st2.Search(sparse.Vector{"0": 1}, 10)
	var keep, remove bool
	for _, r := range results {
		if r.ID == "keep" {
			keep = true
		}
		if r.ID == "remove" {
			remove = true
		}
	}
	if !keep || remove {
		t.Errorf("keep=%v remove=%v", keep, remove)
	}
}
