const { spawnSync } = require('node:child_process');
const [jar, bundle] = process.argv.slice(2);
if (!jar || !bundle) {
  console.error('Usage: node scripts/verify-android.cjs <bundletool.jar> <app.aab>');
  process.exit(1);
}
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw Error(result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
}
const manifest = run('java', ['-jar', jar, 'dump', 'manifest', `--bundle=${bundle}`, '--module=base']);
const forbidden = ['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.RECORD_AUDIO', 'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE'];
for (const permission of forbidden) {
  if (manifest.includes(`android:name="${permission}"`)) throw Error(`Unexpected permission: ${permission}`);
}
if (!manifest.includes('package="com.sip.tracker"')) throw Error('Unexpected package identifier');
const signature = run('jarsigner', ['-verify', bundle]);
if (!signature.includes('jar verified.')) throw Error('Bundle signature did not verify');
console.log('Android package, reduced permissions and JAR signature verified.');
