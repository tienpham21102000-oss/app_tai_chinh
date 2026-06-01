/**
 * Button Debug & Testing Utility
 * Use this to verify button functionality and capture errors
 */

import { useEffect, useRef } from 'react';

export interface ButtonTestResult {
  buttonName: string;
  status: 'pass' | 'fail' | 'pending';
  error?: string;
  timestamp: number;
  details?: Record<string, any>;
}

export class ButtonDebugger {
  private results: ButtonTestResult[] = [];
  private logs: string[] = [];

  log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry, data || '');
    this.logs.push(logEntry);
  }

  recordTest(test: ButtonTestResult) {
    this.results.push(test);
    const status = test.status === 'pass' ? '✓' : test.status === 'fail' ? '✗' : '⏳';
    const errorMsg = test.error ? ` - ${test.error}` : '';
    console.log(`${status} [${test.buttonName}]${errorMsg}`);
  }

  getResults() {
    return this.results;
  }

  getLogs() {
    return this.logs.join('\n');
  }

  exportReport() {
    return {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      passed: this.results.filter((r) => r.status === 'pass').length,
      failed: this.results.filter((r) => r.status === 'fail').length,
      pending: this.results.filter((r) => r.status === 'pending').length,
      results: this.results,
      logs: this.logs,
    };
  }

  // Test individual buttons
  async testNavigationButton(
    buttonName: string,
    navigationFn: () => Promise<void> | void,
    expectedRoute?: string
  ): Promise<ButtonTestResult> {
    try {
      this.log(`Testing button: ${buttonName}`);
      const start = Date.now();
      await navigationFn();
      const duration = Date.now() - start;

      return {
        buttonName,
        status: 'pass',
        timestamp: start,
        details: { duration, expectedRoute },
      };
    } catch (error) {
      return {
        buttonName,
        status: 'fail',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  async testVoiceButton(
    startRecording: () => Promise<void>,
    stopRecording: () => Promise<void>
  ): Promise<ButtonTestResult> {
    try {
      this.log('Testing Voice Button - Starting recording');
      const start = Date.now();

      await startRecording();
      this.log('Voice recording started');

      // Simulate 2 second recording
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await stopRecording();
      const duration = Date.now() - start;

      this.log('Voice recording completed', { duration });
      return {
        buttonName: 'AI Voice Button',
        status: 'pass',
        timestamp: start,
        details: { recordingDuration: duration },
      };
    } catch (error) {
      return {
        buttonName: 'AI Voice Button',
        status: 'fail',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  async testCameraButton(
    launchCamera: () => Promise<void>
  ): Promise<ButtonTestResult> {
    try {
      this.log('Testing Camera Button');
      const start = Date.now();

      await launchCamera();
      const duration = Date.now() - start;

      this.log('Camera action completed', { duration });
      return {
        buttonName: 'Scan Bill Button',
        status: 'pass',
        timestamp: start,
        details: { cameraOpenTime: duration },
      };
    } catch (error) {
      return {
        buttonName: 'Scan Bill Button',
        status: 'fail',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  async testTextInputButton(
    setText: (text: string) => void,
    submitText: () => Promise<void>,
    testText: string = 'Test transaction 50k'
  ): Promise<ButtonTestResult> {
    try {
      this.log('Testing Quick Type Button', { testText });
      const start = Date.now();

      setText(testText);
      await submitText();

      const duration = Date.now() - start;
      this.log('Quick Type completed', { duration, textLength: testText.length });

      return {
        buttonName: 'Quick Type Button',
        status: 'pass',
        timestamp: start,
        details: { processingTime: duration, textLength: testText.length },
      };
    } catch (error) {
      return {
        buttonName: 'Quick Type Button',
        status: 'fail',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  async testDeleteButton(
    deleteAction: () => Promise<void>,
    itemId: string
  ): Promise<ButtonTestResult> {
    try {
      this.log('Testing Delete Button', { itemId });
      const start = Date.now();

      await deleteAction();
      const duration = Date.now() - start;

      this.log('Delete completed', { duration });

      return {
        buttonName: 'Delete Button',
        status: 'pass',
        timestamp: start,
        details: { deletionTime: duration, itemId },
      };
    } catch (error) {
      return {
        buttonName: 'Delete Button',
        status: 'fail',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        details: { itemId },
      };
    }
  }

  async testTabNavigation(
    tabs: Array<{ name: string; switchTo: () => void | Promise<void> }>
  ): Promise<ButtonTestResult[]> {
    const results: ButtonTestResult[] = [];

    for (const tab of tabs) {
      try {
        this.log(`Testing tab: ${tab.name}`);
        const start = Date.now();

        await tab.switchTo();
        const duration = Date.now() - start;

        results.push({
          buttonName: `Tab: ${tab.name}`,
          status: 'pass',
          timestamp: start,
          details: { switchTime: duration },
        });

        this.log(`Tab ${tab.name} loaded`, { duration });
      } catch (error) {
        results.push({
          buttonName: `Tab: ${tab.name}`,
          status: 'fail',
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        });

        this.log(`Tab ${tab.name} failed`, error);
      }
    }

    return results;
  }

  // Permission checking
  checkPermissions() {
    const permissions = {
      camera: false,
      microphone: false,
      mediaLibrary: false,
    };

    this.log('Checking permissions...');

    // These would need proper platform checks
    return permissions;
  }

  // Connection checking
  async checkConnection() {
    try {
      this.log('Checking connection...');
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'HEAD',
      });
      return response.ok;
    } catch (error) {
      this.log('Connection check failed', error);
      return false;
    }
  }
}

// Export singleton instance
export const buttonDebugger = new ButtonDebugger();

// React Hook for debug panel
export function useButtonDebug() {
  const debugRef = useRef(buttonDebugger);

  useEffect(() => {
    // Log when component mounts
    debugRef.current.log('Button Debug Panel Initialized');

    return () => {
      // Log when unmounting
      debugRef.current.log('Button Debug Panel Destroyed');
    };
  }, []);

  return debugRef.current;
}
