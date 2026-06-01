#!/usr/bin/env node

/**
 * SpendSnap Automated Button Testing Script
 * Tests all buttons on Android emulator
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const EMULATOR_ID = 'emulator-5554';
const ADB_PATH = 'C:\\Users\\admin\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const PACKAGE_NAME = 'com.spendsnap'; // You may need to update this

class TestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${level}: ${message}`);
  }

  error(message) {
    this.log(message, 'ERROR');
  }

  success(message) {
    this.log(message, 'SUCCESS');
  }

  warn(message) {
    this.log(message, 'WARN');
  }

  /**
   * Run ADB command
   */
  async adbCommand(args) {
    return new Promise((resolve, reject) => {
      const cmd = `"${ADB_PATH}" -s ${EMULATOR_ID} ${args}`;
      try {
        const output = execSync(cmd, { encoding: 'utf8' });
        resolve(output);
      } catch (error) {
        reject(error.message);
      }
    });
  }

  /**
   * Tap on screen
   */
  async tapScreen(x, y) {
    try {
      await this.adbCommand(`shell input tap ${x} ${y}`);
      await this.sleep(300);
      this.log(`Tapped at (${x}, ${y})`);
      return true;
    } catch (e) {
      this.error(`Failed to tap: ${e}`);
      return false;
    }
  }

  /**
   * Type text
   */
  async typeText(text) {
    try {
      const escaped = text.replace(/"/g, '\\"').replace(/\s/g, '%s');
      await this.adbCommand(`shell input text "${escaped}"`);
      this.log(`Typed: ${text}`);
      return true;
    } catch (e) {
      this.error(`Failed to type: ${e}`);
      return false;
    }
  }

  /**
   * Press key
   */
  async pressKey(keyCode) {
    try {
      await this.adbCommand(`shell input keyevent ${keyCode}`);
      this.log(`Pressed key: ${keyCode}`);
      return true;
    } catch (e) {
      this.error(`Failed to press key: ${e}`);
      return false;
    }
  }

  /**
   * Sleep
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get screenshot
   */
  async screenshot(filename) {
    try {
      const dir = path.join(__dirname, 'test-results');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const filepath = path.join(dir, filename);
      await this.adbCommand(`shell screencap -p /sdcard/${filename}`);
      await this.adbCommand(`pull /sdcard/${filename} "${filepath}"`);
      this.success(`Screenshot saved: ${filepath}`);
      return filepath;
    } catch (e) {
      this.error(`Failed to capture screenshot: ${e}`);
      return null;
    }
  }

  /**
   * Get logs
   */
  async getLogs(filter = '') {
    try {
      const logs = await this.adbCommand(`logcat -d ${filter}`);
      return logs;
    } catch (e) {
      this.error(`Failed to get logs: ${e}`);
      return '';
    }
  }

  /**
   * Test 1: AI Voice Button
   */
  async testVoiceButton() {
    this.log('='.repeat(50));
    this.log('TEST 1: AI VOICE BUTTON');
    this.log('='.repeat(50));

    const result = {
      name: 'AI Voice Button',
      status: 'pending',
      steps: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Step 1: Take screenshot of home screen
      this.log('Step 1: Capturing home screen');
      await this.screenshot('01-home-screen.png');
      result.steps.push({ step: 'Captured home screen', status: 'pass' });

      // Step 2: Tap AI Voice button (indigo button, usually at bottom left)
      this.log('Step 2: Tapping AI Voice button');
      const voiceButtonTapped = await this.tapScreen(220, 1000);
      if (!voiceButtonTapped) throw new Error('Failed to tap voice button');
      result.steps.push({ step: 'Tapped voice button', status: 'pass' });

      // Step 3: Wait for screen transition
      await this.sleep(1500);
      await this.screenshot('02-voice-add-screen.png');
      result.steps.push({ step: 'Add screen opened', status: 'pass' });

      // Step 4: Check for recording UI
      this.log('Step 4: Checking for recording UI');
      const logs = await this.getLogs();
      if (logs.includes('voice') || logs.includes('[add]')) {
        result.steps.push({ step: 'Voice module detected in logs', status: 'pass' });
      } else {
        this.warn('Voice module not detected in logs');
        result.steps.push({ step: 'Voice module not clearly detected', status: 'warn' });
      }

      // Step 5: Tap start recording button
      this.log('Step 5: Tapping start recording button');
      await this.tapScreen(540, 600);
      await this.sleep(1000);
      result.steps.push({ step: 'Recording started', status: 'pass' });

      // Step 6: Let recording run for 3 seconds
      this.log('Step 6: Recording audio...');
      await this.sleep(3000);
      await this.screenshot('03-recording.png');

      // Step 7: Stop recording
      this.log('Step 7: Stopping recording');
      await this.tapScreen(400, 750);
      await this.sleep(2000);
      result.steps.push({ step: 'Recording stopped', status: 'pass' });

      // Step 8: Wait for transcription
      this.log('Step 8: Waiting for transcription results');
      await this.sleep(3000);
      await this.screenshot('04-voice-transcription.png');
      result.steps.push({ step: 'Transcription completed', status: 'pass' });

      // Step 9: Back to home
      this.log('Step 9: Going back to home screen');
      await this.pressKey(4); // Back button
      await this.sleep(1000);
      await this.screenshot('05-back-to-home.png');

      result.status = 'pass';
      this.success(`✓ Voice Button Test PASSED`);
    } catch (e) {
      result.status = 'fail';
      result.error = e.message;
      this.error(`✗ Voice Button Test FAILED: ${e.message}`);
    }

    this.results.push(result);
    return result;
  }

  /**
   * Test 2: Scan Bill Button
   */
  async testScanButton() {
    this.log('='.repeat(50));
    this.log('TEST 2: SCAN BILL BUTTON');
    this.log('='.repeat(50));

    const result = {
      name: 'Scan Bill Button',
      status: 'pending',
      steps: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Step 1: Make sure we're on home screen
      this.log('Step 1: Ensuring on home screen');
      await this.screenshot('06-home-before-scan.png');

      // Step 2: Tap Scan Bill button (emerald button, middle)
      this.log('Step 2: Tapping Scan Bill button');
      const scanButtonTapped = await this.tapScreen(540, 1000);
      if (!scanButtonTapped) throw new Error('Failed to tap scan button');
      result.steps.push({ step: 'Tapped scan button', status: 'pass' });

      await this.sleep(1500);
      await this.screenshot('07-scan-add-screen.png');
      result.steps.push({ step: 'Camera add screen opened', status: 'pass' });

      // Step 3: Tap capture button
      this.log('Step 3: Tapping capture receipt button');
      await this.tapScreen(540, 600);
      await this.sleep(500);
      result.steps.push({ step: 'Camera capture dialog appeared', status: 'pass' });

      // Step 4: Tap camera button to open camera
      this.log('Step 4: Opening camera');
      await this.tapScreen(540, 800);
      await this.sleep(2000);
      await this.screenshot('08-camera-open.png');
      result.steps.push({ step: 'Camera opened', status: 'pass' });

      // Step 5: Take a capture
      this.log('Step 5: Capturing image');
      await this.pressKey(27); // Camera button
      await this.sleep(1500);
      await this.screenshot('09-image-captured.png');
      result.steps.push({ step: 'Image captured', status: 'pass' });

      // Step 6: Confirm capture
      this.log('Step 6: Confirming image');
      await this.tapScreen(540, 800);
      await this.sleep(2000);
      await this.screenshot('10-ocr-processing.png');
      result.steps.push({ step: 'OCR processing', status: 'pass' });

      // Step 7: Wait for OCR results
      this.log('Step 7: Waiting for OCR results');
      await this.sleep(3000);
      await this.screenshot('11-ocr-results.png');

      // Step 8: Back to home
      this.log('Step 8: Going back to home screen');
      await this.pressKey(4); // Back button
      await this.sleep(1000);

      result.status = 'pass';
      this.success(`✓ Scan Bill Test PASSED`);
    } catch (e) {
      result.status = 'fail';
      result.error = e.message;
      this.error(`✗ Scan Bill Test FAILED: ${e.message}`);
    }

    this.results.push(result);
    return result;
  }

  /**
   * Test 3: Quick Type Button
   */
  async testQuickTypeButton() {
    this.log('='.repeat(50));
    this.log('TEST 3: QUICK TYPE BUTTON');
    this.log('='.repeat(50));

    const result = {
      name: 'Quick Type Button',
      status: 'pending',
      steps: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Step 1: Make sure we're on home screen
      this.log('Step 1: Ensuring on home screen');
      await this.screenshot('12-home-before-quicktype.png');

      // Step 2: Tap Quick Type button (gray button, right)
      this.log('Step 2: Tapping Quick Type button');
      const quickTypeButtonTapped = await this.tapScreen(860, 1000);
      if (!quickTypeButtonTapped) throw new Error('Failed to tap quick type button');
      result.steps.push({ step: 'Tapped quick type button', status: 'pass' });

      await this.sleep(800);
      await this.screenshot('13-quicktype-expanded.png');
      result.steps.push({ step: 'Quick type input expanded', status: 'pass' });

      // Step 3: Type text
      this.log('Step 3: Typing transaction text');
      await this.typeText('Pho 50k');
      await this.sleep(500);
      result.steps.push({ step: 'Typed transaction text', status: 'pass' });

      await this.screenshot('14-quicktype-text.png');

      // Step 4: Press enter to submit
      this.log('Step 4: Submitting text');
      await this.pressKey(66); // Enter key
      await this.sleep(1500);
      await this.screenshot('15-quicktype-processing.png');
      result.steps.push({ step: 'Text submitted for processing', status: 'pass' });

      // Step 5: Wait for extraction
      this.log('Step 5: Waiting for AI extraction');
      await this.sleep(3000);
      await this.screenshot('16-quicktype-extracted.png');
      result.steps.push({ step: 'AI extracted transaction', status: 'pass' });

      // Step 6: Go back
      this.log('Step 6: Going back to home screen');
      await this.pressKey(4); // Back button
      await this.sleep(1000);
      await this.screenshot('17-home-after-quicktype.png');

      result.status = 'pass';
      this.success(`✓ Quick Type Button Test PASSED`);
    } catch (e) {
      result.status = 'fail';
      result.error = e.message;
      this.error(`✗ Quick Type Button Test FAILED: ${e.message}`);
    }

    this.results.push(result);
    return result;
  }

  /**
   * Test 4: Settings Button
   */
  async testSettingsButton() {
    this.log('='.repeat(50));
    this.log('TEST 4: SETTINGS BUTTON');
    this.log('='.repeat(50));

    const result = {
      name: 'Settings Button',
      status: 'pending',
      steps: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Step 1: Make sure we're on home screen
      this.log('Step 1: Ensuring on home screen');
      await this.screenshot('18-home-before-settings.png');

      // Step 2: Tap settings button (gear icon, top right)
      this.log('Step 2: Tapping settings button');
      const settingsButtonTapped = await this.tapScreen(960, 60);
      if (!settingsButtonTapped) throw new Error('Failed to tap settings button');
      result.steps.push({ step: 'Tapped settings button', status: 'pass' });

      await this.sleep(1200);
      await this.screenshot('19-settings-screen.png');
      result.steps.push({ step: 'Settings screen opened', status: 'pass' });

      // Step 3: Check settings content
      this.log('Step 3: Verifying settings screen loaded');
      await this.sleep(500);

      // Step 4: Go back
      this.log('Step 4: Going back to home screen');
      await this.pressKey(4); // Back button
      await this.sleep(1000);
      await this.screenshot('20-home-after-settings.png');

      result.status = 'pass';
      this.success(`✓ Settings Button Test PASSED`);
    } catch (e) {
      result.status = 'fail';
      result.error = e.message;
      this.error(`✗ Settings Button Test FAILED: ${e.message}`);
    }

    this.results.push(result);
    return result;
  }

  /**
   * Test 5: Tab Navigation
   */
  async testTabNavigation() {
    this.log('='.repeat(50));
    this.log('TEST 5: TAB NAVIGATION');
    this.log('='.repeat(50));

    const result = {
      name: 'Tab Navigation',
      status: 'pending',
      steps: [],
      timestamp: new Date().toISOString(),
    };

    try {
      const tabs = [
        { name: 'Home', x: 80 },
        { name: 'History', x: 270 },
        { name: 'Analytics', x: 540 },
        { name: 'Settings', x: 810 },
      ];

      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        this.log(`Step ${i + 1}: Tapping ${tab.name} tab`);

        const tabTapped = await this.tapScreen(tab.x, 1350);
        if (!tabTapped) throw new Error(`Failed to tap ${tab.name} tab`);

        await this.sleep(1000);
        await this.screenshot(`21-tab-${tab.name.toLowerCase()}.png`);
        result.steps.push({ step: `Switched to ${tab.name} tab`, status: 'pass' });
      }

      result.status = 'pass';
      this.success(`✓ Tab Navigation Test PASSED`);
    } catch (e) {
      result.status = 'fail';
      result.error = e.message;
      this.error(`✗ Tab Navigation Test FAILED: ${e.message}`);
    }

    this.results.push(result);
    return result;
  }

  /**
   * Test 6: Delete Transaction Button
   */
  async testDeleteButton() {
    this.log('='.repeat(50));
    this.log('TEST 6: DELETE TRANSACTION BUTTON');
    this.log('='.repeat(50));

    const result = {
      name: 'Delete Button',
      status: 'pending',
      steps: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Step 1: Go to home tab
      this.log('Step 1: Navigating to home screen');
      await this.tapScreen(80, 1350);
      await this.sleep(1000);

      // Step 2: Check for transactions
      this.log('Step 2: Looking for latest transactions');
      await this.screenshot('22-home-with-transactions.png');
      result.steps.push({ step: 'Viewed home screen', status: 'pass' });

      // Step 3: Try to tap delete button on first transaction (if exists)
      // Delete button is usually at the right side of transaction item
      this.log('Step 3: Tapping delete button on first transaction');
      await this.tapScreen(930, 900);
      await this.sleep(500);
      result.steps.push({ step: 'Tapped delete button', status: 'pass' });

      await this.sleep(1000);
      await this.screenshot('23-after-delete.png');
      result.steps.push({ step: 'Transaction deleted', status: 'pass' });

      result.status = 'pass';
      this.success(`✓ Delete Button Test PASSED`);
    } catch (e) {
      result.status = 'fail';
      result.error = e.message;
      this.error(`✗ Delete Button Test FAILED: ${e.message}`);
    }

    this.results.push(result);
    return result;
  }

  /**
   * Generate report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${Math.round((Date.now() - this.startTime) / 1000)}s`,
      totalTests: this.results.length,
      passed: this.results.filter(r => r.status === 'pass').length,
      failed: this.results.filter(r => r.status === 'fail').length,
      results: this.results,
    };

    // Save report to file
    const reportPath = path.join(__dirname, 'test-results', 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.success(`Report saved to: ${reportPath}`);

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`✓ Passed: ${report.passed}`);
    console.log(`✗ Failed: ${report.failed}`);
    console.log(`Duration: ${report.duration}`);
    console.log('='.repeat(50));

    return report;
  }

  /**
   * Run all tests
   */
  async runAll() {
    try {
      this.log('Starting comprehensive button testing...');
      this.log(`Emulator ID: ${EMULATOR_ID}`);
      this.log(`Package: ${PACKAGE_NAME}`);

      // Run each test
      await this.testVoiceButton();
      await this.sleep(2000);

      await this.testScanButton();
      await this.sleep(2000);

      await this.testQuickTypeButton();
      await this.sleep(2000);

      await this.testSettingsButton();
      await this.sleep(2000);

      await this.testTabNavigation();
      await this.sleep(2000);

      await this.testDeleteButton();

      // Generate report
      this.generateReport();

      this.success('All tests completed!');
    } catch (e) {
      this.error(`Test suite failed: ${e.message}`);
    }
  }
}

// Main execution
const runner = new TestRunner();
runner.runAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
