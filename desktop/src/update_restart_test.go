package main

import "testing"

func TestRestartParentPID(t *testing.T) {
	tests := []struct {
		name string
		args []string
		want int
	}{
		{name: "missing", args: []string{"--other"}, want: 0},
		{name: "valid", args: []string{"--other", restartAfterPIDPrefix + "4321"}, want: 4321},
		{name: "invalid", args: []string{restartAfterPIDPrefix + "bad"}, want: 0},
		{name: "zero", args: []string{restartAfterPIDPrefix + "0"}, want: 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := restartParentPID(tt.args); got != tt.want {
				t.Fatalf("restartParentPID() = %d, want %d", got, tt.want)
			}
		})
	}
}
