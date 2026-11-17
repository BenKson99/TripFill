/** Calm, kid-friendly user errors. Never returns raw HTTP, URLs, or stack traces. */
export function friendlyError(err: unknown): string {
  const m = (err instanceof Error ? err.message : typeof err === "string" ? err : "").trim();
  const low = m.toLowerCase();
  if (/home city/i.test(m) && /couldn'?t find|could not find|unknown/i.test(m)) {
    return "We couldn't find that home town. Check the spelling or try a bigger city nearby.";
  }
  if (/couldn'?t find|could not find|unknown city|not find "/i.test(m)) {
    return "We couldn't find that town. Check the spelling or try a bigger city nearby.";
  }
  if (/weather unavailable|no usable weather|no historical weather|historical temperatures unavailable|conditions unavailable/i.test(m)) {
    return "We couldn't load the weather right now. Check your connection and try again in a minute.";
  }
  if (/overpass|timed out|timeout|aborted|etimedout|the map data/i.test(low)) {
    return "The map data is taking too long. Try again in a minute — your dates and travelers are still here.";
  }
  if (/failed to fetch|networkerror|network|offline|econnreset|enotfound|econnrefused|load failed/i.test(low) && !/weather/i.test(low)) {
    return "We couldn't reach the internet. Check your connection and try again.";
  }
  if (/in the past/i.test(m)) {
    return "That day is in the past. Pick today or a future day, or plan it anyway as a typical-weather trip.";
  }
  if (/valid start and end dates|valid dates required|end date/i.test(m)) {
    return "Please check the start and end dates and try again.";
  }
  if (!m || /http\s*\d+/i.test(m) || /https?:\/\//i.test(m) || /at\s+\S+\s+\(/i.test(m) || /typeerror|referenceerror|syntaxerror|stack:|econn|enoent|status code/i.test(low)) {
    return "Something went wrong while making your plan. Try again in a minute.";
  }
  if (m.length > 220) return "Something went wrong while making your plan. Try again in a minute.";
  return m;
}
