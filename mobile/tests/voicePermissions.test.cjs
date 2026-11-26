const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { compileModsAsync } = require('expo/config-plugins');
const { getPrebuildConfigAsync } = require('@expo/prebuild-config');

test('generated native configuration allows microphone access for speech recognition', async () => {
  const projectRoot = resolve(__dirname, '..');
  const platforms = ['ios', 'android'];
  const { exp } = await getPrebuildConfigAsync(projectRoot, { platforms });
  await compileModsAsync(exp, {
    projectRoot,
    platforms,
    introspect: true,
    assertMissingModProviders: false,
  });
  const { android, ios } = exp._internal.modResults;
  const permissions = android.manifest.manifest['uses-permission'].map(entry => entry.$);
  const microphone = permissions.filter(entry => entry['android:name'] === 'android.permission.RECORD_AUDIO');
  assert.equal(microphone.length, 1);
  assert.notEqual(microphone[0]['tools:node'], 'remove');
  assert.ok(ios.infoPlist.NSMicrophoneUsageDescription);
  assert.ok(ios.infoPlist.NSSpeechRecognitionUsageDescription);
});
