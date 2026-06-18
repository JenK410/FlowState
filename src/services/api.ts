export async function parseTask(input: string, date?: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

  try {
    console.log(`[API] Fetching /api/parse-task with input size: ${input.length}`);
    const response = await fetch('/api/parse-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: input.slice(0, 100000), date }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Server responded with error ${response.status}:`, errorText);
      let errorMessage = `Failed to parse task: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const data = await response.json();
      console.log(`[API] Received ${Array.isArray(data) ? data.length : 'non-array'} tasks`);
      return data;
    } else {
      const text = await response.text();
      console.warn("[API] Expected JSON response but got:", text);
      return []; 
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error("[API] Request aborted due to 120s timeout");
      throw new Error("Request timed out. Please try a shorter list.");
    }
    console.error("[API] parseTask detailed error:", error);
    throw error;
  }
}
