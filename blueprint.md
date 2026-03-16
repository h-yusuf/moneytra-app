# Monetra React Native + Expo Blueprint

## Overview

Monetra adalah aplikasi mobile untuk mencatat **expense** dan **tabungan nikah** dari hasil upload struk, nota, bukti transfer, atau input manual. Aplikasi menampilkan dashboard modern, tren bulanan, kategori pengeluaran, histori transaksi, serta proses review hasil ekstraksi AI sebelum data disimpan.

Target platform:

* Android
* iOS

Stack utama:

* **Frontend:** React Native + Expo + TypeScript
* **Routing:** Expo Router
* **Styling:** NativeWind (gaya Tailwind untuk React Native)
* **Data fetching:** TanStack Query
* **Local UI state:** Zustand
* **Forms:** React Hook Form + Zod
* **Backend API:** FastAPI
* **AI/OCR:** provider fleksibel (Gemini / DeepSeek / OpenAI / Groq / Anthropic) di backend
* **Database:** PostgreSQL / Supabase
* **Storage:** Supabase Storage / S3-compatible storage

---

## Product Goals

### Core goals

* Upload bukti pembayaran dan struk dari mobile
* Ekstrak data otomatis dengan AI melalui backend
* Review hasil sebelum simpan
* Pisahkan data ke dua tipe utama:

  * Expense
  * Tabungan Nikah
* Tampilkan dashboard modern dengan ringkasan bulanan
* Riwayat transaksi mudah dicari dan difilter

### Future goals

* Auto-categorization yang lebih akurat
* OCR lokal sebagai fallback
* Multi-user / family mode
* Budget planning
* Reminder target tabungan nikah
* Export Excel / PDF report

---

## Recommended Architecture

### Frontend: React Native + Expo

Dipilih karena:

* setup cepat untuk Android dan iOS
* cocok untuk prototype dan produk mobile modern
* integrasi upload file, image picker, dan navigasi relatif cepat
* Expo memudahkan testing di device nyata

### Backend: FastAPI

Dipilih karena:

* cocok untuk OCR / PDF / image pipeline
* mudah integrasi dengan AI provider
* parsing logic Python dari prototype sebelumnya bisa diadaptasi
* cepat untuk bikin endpoint dashboard dan transaksi

### Database

Direkomendasikan:

* **Supabase Postgres** untuk percepatan development

Tabel utama:

* users
* transactions
* uploads
* categories
* monthly_summaries (opsional, bisa dihitung dinamis)

### Storage

Untuk file upload:

* Supabase Storage
* atau AWS S3 / Cloudflare R2

---

## User Flow

### Main flow

1. User buka app
2. Masuk ke dashboard
3. Lihat total expense, total tabungan nikah, tren bulanan, dan kategori teratas
4. User tekan tombol tambah
5. Pilih:

   * Upload file
   * Input manual
6. Sistem ekstrak data via backend
7. User review hasil parsing
8. User simpan transaksi
9. Dashboard otomatis ter-update

### Upload flow

1. Pilih file gambar / PDF
2. Preview file
3. Kirim ke backend
4. Backend melakukan OCR / AI extraction
5. Backend mengembalikan JSON terstruktur
6. User edit bila perlu
7. Simpan ke database

### Manual input flow

1. User isi form manual
2. Pilih jenis data: Expense / Tabungan Nikah
3. Simpan
4. Dashboard ter-update

---

## Main Features

### 1. Dashboard

Halaman utama setelah login.

#### Widget utama

* Total Expense bulan ini
* Total Tabungan Nikah bulan ini
* Total transaksi bulan ini
* Progress target tabungan nikah
* Perbandingan bulan ini vs bulan lalu

#### Charts

* Line chart pengeluaran per bulan
* Bar chart tabungan per bulan
* Pie / donut chart kategori expense
* Recent transactions list

#### Filter dashboard

* Bulan
* Tahun
* Jenis data
* Kategori

---

### 2. Add Transaction

#### Input modes

* Upload image
* Upload PDF
* Manual form

#### Review result fields

* Tanggal
* Merchant / Sumber
* Kategori
* Metode Pembayaran
* Total
* Catatan
* Jenis Data

#### Jenis Data

* Expense
* Tabungan Nikah

---

### 3. Transactions History

#### Fitur

* List semua transaksi
* Search by merchant / note
* Filter by kategori
* Filter by date range
* Filter by jenis data
* Edit transaksi
* Delete transaksi

---

### 4. Upload Preview Page

#### Preview support

* Image preview
* PDF first page preview
* OCR text preview
* Parsed JSON preview

---

### 5. Settings

#### Konfigurasi pengguna

* Currency
* Target tabungan nikah
* Default category mapping
* Theme mode
* Notifications

---

## UI / UX Direction

### Design style

Target style:

* modern
* clean
* premium fintech feel
* soft cards
* rounded corners besar
* spacious layout
* mobile-first

### Suggested visual language

* light theme dengan aksen emerald / teal
* dark theme opsional
* kartu metrik dengan shadow lembut
* chart clean tanpa visual berlebihan
* icon minimal outline

### Styling approach with NativeWind

Tailwind asli tidak berjalan langsung di React Native. Pendekatan yang dipakai adalah **NativeWind**, sehingga gaya penulisan tetap terasa seperti Tailwind.

Contoh gaya:

```tsx
<View className="flex-1 bg-slate-50 px-4 pt-6">
  <Text className="text-2xl font-bold text-slate-900">Dashboard</Text>
</View>
```

---

## Design System Blueprint

### Colors

* Primary: Emerald / Teal
* Success: Green
* Warning: Amber
* Danger: Red
* Surface: White / Dark gray
* Background: Off-white / Near-black

### Typography

* Heading large
* Heading medium
* Body regular
* Caption small
* Numeric emphasis style untuk total uang

### Spacing scale

* xs = 4
* sm = 8
* md = 12
* lg = 16
* xl = 24
* 2xl = 32

### Radius

* sm = 8
* md = 12
* lg = 16
* xl = 24

---

## Suggested Frontend Folder Structure

```text
monetra-app/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── history.tsx
│   │   ├── add.tsx
│   │   └── settings.tsx
│   ├── auth/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── transaction/
│   │   ├── [id].tsx
│   │   └── review.tsx
│   └── _layout.tsx
├── src/
│   ├── components/
│   │   ├── common/
│   │   ├── cards/
│   │   ├── charts/
│   │   └── forms/
│   ├── features/
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── upload/
│   │   └── settings/
│   ├── hooks/
│   ├── lib/
│   │   ├── api.ts
│   │   ├── query-client.ts
│   │   ├── storage.ts
│   │   └── utils.ts
│   ├── store/
│   ├── types/
│   ├── constants/
│   └── theme/
├── assets/
├── app.json
├── babel.config.js
├── tailwind.config.js
├── global.css
├── metro.config.js
├── package.json
└── tsconfig.json
```

---

## Recommended State Management

Direkomendasikan kombinasi:

* **TanStack Query** untuk async server state
* **Zustand** untuk local UI state ringan

Alasan:

* server state dashboard dan transactions lebih cocok di-query/cache
* form dan state preview lebih ringan jika dipisah

---

## Recommended Packages

### Core

* expo
* expo-router
* react-native-safe-area-context
* react-native-screens
* react-native-gesture-handler
* react-native-reanimated

### Styling

* nativewind
* tailwindcss
* clsx
* tailwind-merge

### State / Fetching

* @tanstack/react-query
* zustand
* axios

### Forms / Validation

* react-hook-form
* zod
* @hookform/resolvers

### Upload / Files

* expo-image-picker
* expo-document-picker
* expo-file-system

### Charts

* victory-native
* react-native-svg

### Utils

* dayjs
* uuid

---

## Data Model Blueprint

### Transaction

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "type": "expense",
  "source_name": "IMG_1234.jpg",
  "transaction_date": "2026-03-16",
  "merchant": "Indomaret",
  "category": "Makanan / Kebutuhan Harian",
  "payment_method": "QRIS",
  "total": 25000,
  "notes": "Belanja snack",
  "file_url": "https://...",
  "created_at": "2026-03-16T09:00:00Z"
}
```

### Types

* expense
* wedding_savings

---

## Backend API Blueprint

### Main endpoints

#### Auth

* `POST /auth/login`
* `POST /auth/register`
* `POST /auth/logout`

#### Dashboard

* `GET /dashboard/summary?month=...&year=...`
* `GET /dashboard/charts?month=...&year=...`
* `GET /dashboard/recent-transactions`

#### Transactions

* `GET /transactions`
* `POST /transactions`
* `GET /transactions/{id}`
* `PUT /transactions/{id}`
* `DELETE /transactions/{id}`

#### Upload / Extraction

* `POST /uploads/extract`
* `POST /uploads/manual`

#### Settings

* `GET /settings`
* `PUT /settings`

---

## Extraction Pipeline

### Image / PDF upload pipeline

1. Receive file from app
2. Store raw file in storage
3. Detect file type
4. If PDF:

   * read first page preview
   * extract text from PDF
5. If image:

   * OCR / multimodal extraction
6. Filter relevant text
7. Send to AI extraction prompt
8. Return structured JSON
9. User reviews and confirms
10. Save final transaction

### Structured output target

```json
{
  "tanggal": "2026-03-16",
  "merchant": "Indomaret",
  "kategori": "Makanan / Kebutuhan Harian",
  "payment_method": "QRIS",
  "total": "25000",
  "notes": "Snack dan minuman"
}
```

---

## Dashboard Modules

### Top summary cards

* Expense bulan ini
* Tabungan nikah bulan ini
* Total transaksi
* Growth vs bulan lalu

### Monthly analytics

* Expense trend 6 bulan
* Wedding savings trend 6 bulan
* Highest category this month
* Highest spending merchant

### Insights cards

* Kategori terbesar bulan ini
* Rata-rata pengeluaran harian
* Hari paling boros
* Persentase tabungan terhadap pemasukan, bila fitur income nanti ditambahkan

---

## Key Screens

### 1. Splash / Onboarding

* logo Monetra
* value proposition singkat

### 2. Auth Screen

* login
* register

### 3. Dashboard Screen

* summary cards
* charts
* quick actions
* recent transactions

### 4. Add Transaction Screen

* segmented choice: Upload / Manual
* type choice: Expense / Tabungan Nikah

### 5. Upload Review Screen

* preview image/PDF
* extracted text
* parsed fields
* save button

### 6. History Screen

* list + search + filter

### 7. Transaction Detail Screen

* full detail
* edit / delete

### 8. Settings Screen

* profile
* theme
* targets
* API / sync status

---

## Suggested Navigation

Gunakan bottom tabs dengan 4 tab:

* Dashboard
* History
* Add
* Settings

Alternatif label:

* Home
* Transactions
* Add
* Settings

---

## Responsive Strategy

Agar UI flexible:

* mobile-first
* gunakan reusable layout container
* grid cards tetap nyaman di device besar
* chart dan list bisa stacked atau diperlebar tergantung ukuran layar

---

## MVP Scope

Versi pertama sebaiknya fokus pada:

* login sederhana
* dashboard summary
* upload image/PDF
* manual input
* AI extraction
* review before save
* history list
* edit/delete transaksi

Jangan dulu masukkan:

* budget planner
* family sharing
* advanced analytics
* offline sync kompleks

---

## Phase Plan

### Phase 1 - Foundation

* setup Expo + TypeScript
* setup Expo Router
* setup NativeWind
* setup TanStack Query
* setup Axios client
* setup auth skeleton

### Phase 2 - Core Data

* transaction model
* dashboard API integration
* history list
* transaction detail

### Phase 3 - Upload

* file picker
* image/pdf preview
* upload endpoint integration
* review screen

### Phase 4 - Polish

* animations
* loading states
* error states
* empty states
* better charts

### Phase 5 - Growth

* export reports
* savings target progress
* notifications
* category intelligence

---

## Suggested Backend Folder Structure

```text
backend/
  app/
    main.py
    api/
      routes/
        auth.py
        dashboard.py
        transactions.py
        uploads.py
        settings.py
    core/
      config.py
      security.py
    services/
      ai_service.py
      extraction_service.py
      storage_service.py
      dashboard_service.py
    models/
      user.py
      transaction.py
    schemas/
      transaction.py
      dashboard.py
    db/
      session.py
      base.py
```

---

## Security Notes

* simpan API keys di backend, bukan di app React Native
* gunakan JWT atau Supabase Auth
* gunakan signed URL untuk file upload bila perlu
* sanitasi file upload
* batasi ukuran file

---

## Deployment Suggestion

### Frontend

* Android: APK / AAB via EAS Build
* iOS: build via EAS Build lalu distribusi dengan TestFlight

### Backend

* Railway / Render / Fly.io / VPS

### Database

* Supabase

### Storage

* Supabase Storage / S3

---

## Final Recommendation

Stack paling cocok untuk Monetra:

* **React Native + Expo** untuk mobile app
* **Expo Router** untuk navigation
* **NativeWind** untuk styling ala Tailwind
* **TanStack Query** untuk server state
* **Zustand** untuk local UI state
* **FastAPI** untuk backend OCR / AI / dashboard
* **Supabase Postgres** untuk database
* **Supabase Storage** untuk file uploads

Ini memberi fondasi yang modern, scalable, cepat dibangun, dan mudah dikembangkan dari prototype Python sebelumnya.

---

<!-- # Prompt untuk Windsurf

Gunakan prompt berikut di Windsurf agar dia membangun fondasi project Monetra sesuai blueprint ini.

## Prompt utama

```text
Buatkan project mobile bernama Monetra menggunakan React Native + Expo + TypeScript.

Tujuan aplikasi:
Monetra adalah aplikasi untuk mencatat expense dan tabungan nikah dari hasil upload struk, nota, bukti transfer, atau input manual. Aplikasi harus memiliki dashboard modern, histori transaksi, halaman tambah transaksi, halaman review hasil parsing, dan settings.

Gunakan stack berikut:
- Expo
- TypeScript
- Expo Router
- NativeWind untuk styling ala Tailwind
- TanStack Query untuk data fetching
- Zustand untuk local UI state
- React Hook Form + Zod untuk form
- Axios untuk API client
- Victory Native untuk charts

Buat fondasi project yang production-minded, rapi, scalable, dan modular.

Kebutuhan utama:
1. Setup project Expo Router dengan struktur folder yang rapi.
2. Setup NativeWind lengkap agar className bisa dipakai di komponen React Native.
3. Setup theme dasar dengan warna modern fintech: emerald, slate, white.
4. Buat bottom tab navigation dengan 4 tab:
   - Dashboard
   - History
   - Add
   - Settings
5. Buat screen placeholder yang sudah terlihat modern dan tidak polos.
6. Dashboard harus memiliki:
   - header greeting
   - 3 summary cards
   - chart placeholder
   - recent transactions section
7. Add screen harus memiliki:
   - pilihan jenis data: Expense / Tabungan Nikah
   - tombol Upload File
   - tombol Input Manual
8. History screen harus memiliki:
   - search bar
   - filter chips placeholder
   - list transaksi dummy
9. Settings screen harus memiliki:
   - profile card
   - target tabungan card
   - theme/settings options placeholder
10. Buat reusable components untuk:
   - AppContainer
   - SummaryCard
   - SectionHeader
   - EmptyState
   - PrimaryButton
11. Buat file API client dasar memakai Axios dan environment variable untuk base URL.
12. Buat types dasar untuk Transaction dan DashboardSummary.
13. Buat struktur folder berikut:
   - app/
   - src/components/
   - src/features/
   - src/lib/
   - src/store/
   - src/types/
   - src/theme/
14. Pakai TypeScript strict-friendly.
15. UI harus clean, modern, rounded, spacing lega, dan siap dikembangkan.

Output yang saya inginkan:
- semua file awal yang diperlukan
- kode minimal tapi rapi dan siap run
- tidak perlu backend dulu, boleh gunakan dummy data
- jangan buat sekadar placeholder polos; buat tampilan dashboard yang meyakinkan

Setelah struktur dasar selesai, lanjutkan dengan menyiapkan hook dan service dummy untuk dashboard dan transaction list.
```

## Prompt lanjutan untuk tahap berikutnya

```text
Lanjutkan project Monetra yang sudah dibuat.

Tugas berikutnya:
1. Implementasikan halaman Review Transaction.
2. Buat form review editable dengan React Hook Form + Zod.
3. Field yang harus ada:
   - tanggal
   - merchant / sumber
   - kategori
   - metode pembayaran
   - total
   - catatan
   - jenis data
4. Tambahkan file preview area untuk image / PDF placeholder.
5. Buat flow navigasi dari Add screen ke Review screen.
6. Siapkan upload service dummy untuk simulasi respons backend.
7. Simulasikan hasil parsing AI dalam bentuk JSON lalu isi default form review dari sana.
8. Pertahankan style modern yang konsisten dengan dashboard.
9. Buat komponen form reusable bila perlu.
10. Pastikan struktur project tetap rapi dan modular.
```

## Prompt backend nanti

```text
Buat backend FastAPI untuk Monetra.

Fitur utama backend:
- endpoint upload file image/PDF
- endpoint ekstraksi data transaksi dari hasil OCR/AI
- endpoint dashboard summary
- endpoint recent transactions
- endpoint list/create/update/delete transactions

Gunakan struktur modular:
- app/api/routes
- app/services
- app/models
- app/schemas
- app/core
- app/db

Siapkan abstraction untuk AI provider agar nanti bisa memakai Gemini, DeepSeek, OpenAI, Groq, atau Anthropic.

Output sementara boleh memakai in-memory dummy data, tapi struktur harus siap untuk Postgres/Supabase.
``` -->
