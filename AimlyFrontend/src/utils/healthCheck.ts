/**
 * Health Check Utility for AI Aimly Pro
 * Monitors backend server health status
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost';
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT;
const API_BASE = BACKEND_PORT ? `${BACKEND_URL}:${BACKEND_PORT}` : BACKEND_URL;

export interface HealthCheckResult {
  isHealthy: boolean;
  error?: string;
  responseTime?: number;
}

/**
 * Check if the backend server is healthy and responsive
 */
export const checkServerHealth = async (timeout: number = 10000): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${API_BASE}/health/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    // Check if the response is ok
    if (!response.ok) {
      return {
        isHealthy: false,
        error: `Server responded with status ${response.status}`,
        responseTime,
      };
    }

    // Try to parse the response
    const data = await response.json();
    
    // Updated: Check for new health response format
    // New backend returns: { status: "healthy", timestamp: "...", database: "connected", services: {...} }
    if (data.status !== 'healthy') {
      return {
        isHealthy: false,
        error: 'Server reports unhealthy status',
        responseTime,
      };
    }

    return {
      isHealthy: true,
      responseTime,
    };

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      return {
        isHealthy: false,
        error: 'Server health check timed out',
        responseTime,
      };
    }

    if (error.code === 'NETWORK_ERROR' || error.message.includes('fetch')) {
      return {
        isHealthy: false,
        error: 'Unable to connect to server',
        responseTime,
      };
    }

    return {
      isHealthy: false,
      error: error.message || 'Unknown error occurred',
      responseTime,
    };
  }
};

/**
 * Perform multiple health checks with exponential backoff
 */
export const performHealthChecks = async (
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<HealthCheckResult> => {
  let lastResult: HealthCheckResult = { isHealthy: false, error: 'No attempts made' };
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    
    lastResult = await checkServerHealth();
    
    if (lastResult.isHealthy) {
      return lastResult;
    }
    
    // If not the last attempt, wait before retrying
    if (attempt < maxRetries - 1) {
      const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return lastResult;
};

/**
 * Create a health check monitor that runs periodically
 */
export class HealthMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;
  private onStatusChange: ((isHealthy: boolean, result: HealthCheckResult) => void) | null = null;
  private lastHealthyStatus: boolean = true;
  private checkIntervalMs: number;
  private timeoutMs: number;

  constructor(
    checkIntervalMs: number = 30000, // Check every 30 seconds
    timeoutMs: number = 10000 // 10 second timeout
  ) {
    this.checkIntervalMs = checkIntervalMs;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Start monitoring server health
   */
  start(onStatusChange: (isHealthy: boolean, result: HealthCheckResult) => void): void {
    if (this.isRunning) {
      return;
    }

    this.onStatusChange = onStatusChange;
    this.isRunning = true;

    // Perform initial check
    this.performCheck();

    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.performCheck();
    }, this.checkIntervalMs);
  }

  /**
   * Stop monitoring server health
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    this.onStatusChange = null;
  }

  /**
   * Perform a single health check
   */
  private async performCheck(): Promise<void> {
    try {
      const result = await checkServerHealth(this.timeoutMs);
      
      // Only notify if status changed
      if (result.isHealthy !== this.lastHealthyStatus) {
        this.lastHealthyStatus = result.isHealthy;
        
        if (this.onStatusChange) {
          this.onStatusChange(result.isHealthy, result);
        }
      }
    } catch (error) {
    }
  }

  /**
   * Get current running status
   */
  getStatus(): { isRunning: boolean; lastHealthyStatus: boolean } {
    return {
      isRunning: this.isRunning,
      lastHealthyStatus: this.lastHealthyStatus,
    };
  }
}

/**
 * Quick health check with promise that resolves when server is healthy
 */
export const waitForServerHealth = async (
  maxWaitTimeMs: number = 60000,
  checkIntervalMs: number = 2000
): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTimeMs) {
    const result = await checkServerHealth();
    
    if (result.isHealthy) {
      return result;
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
  }
  
  return {
    isHealthy: false,
    error: `Server did not become healthy within ${maxWaitTimeMs}ms`,
  };
};

// Export a default health monitor instance
export const healthMonitor = new HealthMonitor();

export default {
  checkServerHealth,
  performHealthChecks,
  HealthMonitor,
  healthMonitor,
  waitForServerHealth,
};