/**
 * Performance Tracker for Interview Timing
 * Logs timing metrics to browser console
 */

interface TimingEntry {
  label: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class PerformanceTracker {
  private timings: Map<string, TimingEntry> = new Map();
  private enabled: boolean = true;

  constructor() {
    // Enable in development or if explicitly enabled
    this.enabled = process.env.NODE_ENV === "development" ||
      (typeof window !== "undefined" && (window as any).__PERF_TRACKER_ENABLED__);
  }

  enable() {
    this.enabled = true;
    this.log("Performance tracking enabled");
  }

  disable() {
    this.enabled = false;
  }

  private log(message: string, data?: object) {
    if (!this.enabled || typeof window === "undefined") return;

    const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
    console.log(
      `%c[PERF ${timestamp}]%c ${message}`,
      "color: #00bcd4; font-weight: bold",
      "color: inherit",
      data || ""
    );
  }

  private logTiming(label: string, durationMs: number, details?: string) {
    if (!this.enabled || typeof window === "undefined") return;

    const color = durationMs < 500 ? "#4caf50" : durationMs < 2000 ? "#ff9800" : "#f44336";
    const emoji = durationMs < 500 ? "⚡" : durationMs < 2000 ? "⏱️" : "🐢";

    console.log(
      `%c${emoji} ${label}%c ${durationMs.toFixed(0)}ms ${details || ""}`,
      `color: ${color}; font-weight: bold`,
      "color: inherit"
    );
  }

  // Start timing an operation
  start(label: string) {
    if (!this.enabled) return;

    this.timings.set(label, {
      label,
      startTime: performance.now(),
    });
    this.log(`▶️ Started: ${label}`);
  }

  // End timing and log result
  end(label: string, details?: string): number {
    if (!this.enabled) return 0;

    const entry = this.timings.get(label);
    if (!entry) {
      console.warn(`[PERF] No start time for: ${label}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - entry.startTime;

    entry.endTime = endTime;
    entry.duration = duration;

    this.logTiming(label, duration, details);
    return duration;
  }

  // Log an instant event
  mark(label: string, details?: string) {
    this.log(`📍 ${label}`, details ? { details } : undefined);
  }

  // Log interview state
  logInterviewState(state: {
    questionIndex?: number;
    totalQuestions?: number;
    isAvatarSpeaking?: boolean;
    isUserSpeaking?: boolean;
    isProcessing?: boolean;
  }) {
    if (!this.enabled || typeof window === "undefined") return;

    console.log(
      "%c[Interview State]",
      "color: #9c27b0; font-weight: bold",
      state
    );
  }

  // Log API call with cost estimate
  logApiCall(params: {
    endpoint: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    durationMs: number;
  }) {
    if (!this.enabled || typeof window === "undefined") return;

    // Estimate costs based on model
    let costEstimate = 0;
    if (params.model?.includes("haiku")) {
      costEstimate = ((params.inputTokens || 0) * 0.00025 + (params.outputTokens || 0) * 0.00125) / 1000;
    } else if (params.model?.includes("sonnet")) {
      costEstimate = ((params.inputTokens || 0) * 0.003 + (params.outputTokens || 0) * 0.015) / 1000;
    }

    console.log(
      "%c[API Call]%c %s %c%dms%c %s",
      "color: #ff5722; font-weight: bold",
      "color: inherit",
      params.endpoint,
      params.durationMs < 1000 ? "color: #4caf50" : "color: #f44336",
      params.durationMs,
      "color: inherit",
      params.model ? `| ${params.model} | ~$${costEstimate.toFixed(5)}` : ""
    );
  }

  // Summary of all timings
  summary() {
    if (!this.enabled || typeof window === "undefined") return;

    console.log("%c📊 Performance Summary", "color: #2196f3; font-weight: bold; font-size: 14px");

    let total = 0;
    this.timings.forEach((entry) => {
      if (entry.duration) {
        total += entry.duration;
        this.logTiming(`  ${entry.label}`, entry.duration);
      }
    });

    console.log(
      "%cTotal tracked time: %c%dms",
      "color: #2196f3",
      "color: #2196f3; font-weight: bold",
      total.toFixed(0)
    );
  }

  // Clear all timings
  clear() {
    this.timings.clear();
  }
}

// Singleton instance
export const perfTracker = new PerformanceTracker();

// Make available on window for debugging
if (typeof window !== "undefined") {
  (window as any).perfTracker = perfTracker;
}
