# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Build App (EAS)

Untuk build aplikasi menjadi APK (Android) atau IPA (iOS), gunakan EAS (Expo Application Services):

### Opsi A: Menggunakan npx (tanpa install global)

```bash
# Init project dengan ID (jika sudah ada project ID)
npx eas-cli@latest init --id 0f7b789b-9b59-44cd-95c0-748d0885ef39

# Build untuk semua platform
npx eas-cli@latest build --platform all

# Build dan auto-submit ke app store
npx eas-cli@latest build --platform all --auto-submit
```

### Opsi B: Install EAS CLI Global

#### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

#### 2. Login ke Expo Account

```bash
eas login
```

#### 3. Configure Project

```bash
eas build:configure
```

#### 4. Build Android APK/AAB

```bash
# Build APK (untuk testing)
eas build -p android --profile preview

# Build AAB (untuk Play Store production)
eas build -p android --profile production
```

#### 5. Build iOS IPA

> ⚠️ **Note**: Build iOS hanya bisa dilakukan di Mac dan memerlukan Apple Developer Account ($99/tahun)

```bash
eas build -p ios --profile production
```

### 6. Download Build

Setelah build selesai, file APK/IPA bisa di-download dari:
- Expo Dashboard: https://expo.dev/accounts/[username]/projects/[project-name]/builds
- Atau dari link yang muncul di terminal setelah build selesai

---

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
