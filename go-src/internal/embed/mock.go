// Package embed provides a mock text-to-vector function for testing.
// Production use should use the Python vecfs_embed or an embedding API.
package embed

import (
	"hash/fnv"
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/WazzaMo/vecfs/internal/sparse"
)

var wordRe = regexp.MustCompile(`\w+`)

// MockEmbed converts text to a sparse vector (word-hash dimensions, L2 normalised).
// Matches the behaviour of the mock in ts-src/integration.test.ts for testing.
func MockEmbed(text string) sparse.Vector {
	words := wordRe.FindAllString(strings.ToLower(text), -1)
	var filtered []string
	for _, w := range words {
		if len(w) > 2 {
			filtered = append(filtered, w)
		}
	}
	if len(filtered) == 0 {
		return sparse.Vector{}
	}
	vec := make(sparse.Vector)
	for _, w := range filtered {
		h := fnv.New32a()
		h.Write([]byte(w))
		dim := int(h.Sum32() % 100)
		key := strconv.Itoa(dim)
		vec[key] = vec[key] + 1
	}
	// L2 normalise
	var sumSq float64
	for _, v := range vec {
		sumSq += v * v
	}
	n := math.Sqrt(sumSq)
	if n > 0 {
		for k := range vec {
			vec[k] /= n
		}
	}
	return vec
}
