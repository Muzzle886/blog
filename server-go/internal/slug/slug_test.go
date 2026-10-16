package slug

import "testing"

func TestTagMatchesNode(t *testing.T) {
	cases := map[string]string{
		"Hello World": "hello-world",
		"设计系统":        "%E8%AE%BE%E8%AE%A1%E7%B3%BB%E7%BB%9F-gxvnj2",
		"---":         "tag-37431k",
	}
	for in, want := range cases {
		if got := Tag(in); got != want {
			t.Errorf("Tag(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNormalize(t *testing.T) {
	got := Normalize([]string{" Go ", "go", "API", ""}, 8)
	if len(got) != 2 || got[0] != "Go" || got[1] != "API" {
		t.Fatalf("%#v", got)
	}
}
