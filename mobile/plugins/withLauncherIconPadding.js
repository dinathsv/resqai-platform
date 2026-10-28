const { withAndroidManifest } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Keep the original bitmap intact; Android applies the padding in a drawable.
module.exports = function withLauncherIconPadding(config) {
  return withAndroidManifest(config, async (config) => {
    const res = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res');
    const resources = {
      'drawable/resqai_launcher_foreground.xml': `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
  android:drawable="@mipmap/ic_launcher_foreground"
  android:insetLeft="18%" android:insetTop="18%"
  android:insetRight="18%" android:insetBottom="18%" />`,
      'values/resqai_launcher.xml': `<?xml version="1.0" encoding="utf-8"?>
<resources><item type="mipmap" name="resqai_launcher">@mipmap/ic_launcher</item></resources>`,
      'mipmap-anydpi-v26/resqai_launcher.xml': `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/iconBackground" />
  <foreground android:drawable="@drawable/resqai_launcher_foreground" />
  <monochrome android:drawable="@drawable/resqai_launcher_foreground" />
</adaptive-icon>`,
    };
    for (const [name, contents] of Object.entries(resources)) {
      const destination = path.join(res, name);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, contents + '\n');
    }
    const application = config.modResults.manifest.application[0];
    application.$['android:icon'] = '@mipmap/resqai_launcher';
    application.$['android:roundIcon'] = '@mipmap/resqai_launcher';
    return config;
  });
};
