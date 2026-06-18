# FlowState Mobile

This is an Expo mobile wrapper for the FlowState web app.

## Run

Start the FlowState web server from the parent folder:

```powershell
cd ..
$env:PORT="3001"
npm.cmd run dev
```

Then start Expo from this folder:

```powershell
npm.cmd install
npm.cmd run start
```

If you use Expo Go on a real phone, `127.0.0.1` points to the phone, not your computer. Enter your computer's local IP address in the app, for example:

```text
http://192.168.12.145:3001
```

For Android Emulator, use:

```text
http://10.0.2.2:3001
```
