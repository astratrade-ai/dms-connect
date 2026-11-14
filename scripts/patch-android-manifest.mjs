import fs from "node:fs";
const file = "android/app/src/main/AndroidManifest.xml";
if (!fs.existsSync(file)) throw new Error(`Android manifest not found: ${file}`);
let xml = fs.readFileSync(file, "utf8");
const permissions = [
  "android.permission.INTERNET",
  "android.permission.ACCESS_NETWORK_STATE",
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS"
];
for (const permission of permissions) {
  if (!xml.includes(`android:name="${permission}"`)) {
    xml = xml.replace("<application", `    <uses-permission android:name="${permission}" />\n    <application`);
  }
}
fs.writeFileSync(file, xml);
console.log("Android runtime permissions added.");
