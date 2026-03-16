# Monetra - Aplikasi Pencatat Keuangan & Tabungan Nikah

Monetra adalah aplikasi mobile untuk mencatat **expense** dan **tabungan nikah** dari hasil upload struk, nota, bukti transfer, atau input manual. Aplikasi ini dibangun dengan React Native + Expo dan mengikuti blueprint yang telah dirancang.

## 🚀 Tech Stack

- **Frontend:** React Native + Expo + TypeScript
- **Routing:** Expo Router
- **Styling:** NativeWind (Tailwind CSS untuk React Native)
- **State Management:** Zustand (local UI state)
- **Data Fetching:** TanStack Query (ready untuk integrasi API)
- **Forms:** React Hook Form + Zod
- **Icons:** SF Symbols (iOS) / Material Icons (Android)
- **File Upload:** Expo Image Picker + Document Picker

## 📱 Fitur Utama

### 1. Dashboard
- Summary cards untuk expense dan tabungan nikah bulan ini
- Statistik total transaksi dan kategori teratas
- Growth indicator vs bulan lalu
- List transaksi terbaru

### 2. History
- Daftar semua transaksi
- Search bar untuk mencari merchant, kategori, atau catatan
- Filter transaksi (siap dikembangkan)

### 3. Add Transaction
- Pilih jenis data: Expense atau Tabungan Nikah
- Upload gambar struk
- Upload PDF invoice
- Input manual (siap dikembangkan)

### 4. Settings
- Profil pengguna
- Target tabungan nikah dengan progress bar
- Preferensi mata uang dan tema
- Menu bantuan dan logout

## 🏗️ Struktur Project

```
monetra-app/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab navigation
│   │   ├── index.tsx        # Dashboard screen
│   │   ├── history.tsx      # History screen
│   │   ├── add.tsx          # Add transaction screen
│   │   └── settings.tsx     # Settings screen
│   └── _layout.tsx          # Root layout
├── src/
│   ├── components/
│   │   └── common/
│   │       ├── AppContainer.tsx
│   │       ├── SummaryCard.tsx
│   │       ├── SectionHeader.tsx
│   │       ├── PrimaryButton.tsx
│   │       ├── EmptyState.tsx
│   │       └── TransactionCard.tsx
│   ├── lib/
│   │   ├── api.ts           # Axios client
│   │   ├── utils.ts         # Helper functions
│   │   └── dummy-data.ts    # Dummy data untuk development
│   ├── store/
│   │   └── useTransactionStore.ts
│   ├── types/
│   │   └── index.ts         # TypeScript types
│   ├── theme/
│   │   └── colors.ts        # Color palette
│   └── constants/
│       └── categories.ts    # Categories & payment methods
├── global.css               # Tailwind CSS
├── tailwind.config.js       # Tailwind configuration
└── nativewind-env.d.ts      # NativeWind types
```

## 🎨 Design System

### Colors
- **Primary:** Teal/Emerald (#0d9488)
- **Success:** Green
- **Warning:** Amber
- **Danger:** Red
- **Background:** Slate 50
- **Surface:** White
- **Text:** Slate 900/600/400

### Typography
- **Heading Large:** 3xl font-bold
- **Heading Medium:** 2xl font-bold
- **Body:** base font-normal
- **Caption:** sm/xs

### Spacing
- Consistent padding: px-4 (16px)
- Card spacing: mb-3/mb-4
- Rounded corners: rounded-xl/rounded-2xl

## 🚦 Getting Started

### Prerequisites
- Node.js 18+
- npm atau yarn
- Expo CLI
- iOS Simulator (Mac) atau Android Emulator

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npx expo start
```

3. Run on device:
- Press `i` untuk iOS simulator
- Press `a` untuk Android emulator
- Scan QR code dengan Expo Go app untuk physical device

## 📝 Data Model

### Transaction
```typescript
{
  id: string;
  user_id: string;
  type: 'expense' | 'wedding_savings';
  transaction_date: string;
  merchant: string;
  category: string;
  payment_method: PaymentMethod;
  total: number;
  notes?: string;
  file_url?: string;
  created_at: string;
}
```

### Dashboard Summary
```typescript
{
  total_expense: number;
  total_wedding_savings: number;
  total_transactions: number;
  expense_growth: number;
  savings_growth: number;
  top_category: { name: string; total: number };
  top_merchant: { name: string; total: number };
}
```

## 🔌 Backend Integration (Ready)

API client sudah disiapkan di `src/lib/api.ts` menggunakan Axios. Untuk mengintegrasikan dengan backend:

1. Set environment variable `EXPO_PUBLIC_API_URL` di `.env`
2. Implementasikan endpoint sesuai blueprint:
   - `POST /auth/login`
   - `GET /dashboard/summary`
   - `GET /transactions`
   - `POST /transactions`
   - `POST /uploads/extract`

3. Ganti dummy data dengan TanStack Query hooks

## 🎯 Next Steps

### Phase 1 - Backend Integration
- [ ] Setup FastAPI backend
- [ ] Implementasi authentication
- [ ] Connect API endpoints
- [ ] Replace dummy data dengan real API calls

### Phase 2 - Upload & AI Extraction
- [ ] Implementasi upload flow
- [ ] Integrate AI/OCR extraction
- [ ] Review screen untuk hasil parsing
- [ ] Save transaction flow

### Phase 3 - Advanced Features
- [ ] Charts dengan Victory Native
- [ ] Filter & sorting transaksi
- [ ] Edit & delete transaksi
- [ ] Export reports
- [ ] Notifications

### Phase 4 - Polish
- [ ] Loading states
- [ ] Error handling
- [ ] Offline support
- [ ] Performance optimization
- [ ] Testing

## 🐛 Known Issues

- TypeScript errors untuk icon names (IconSymbol) - tidak mempengaruhi runtime
- Path alias `@/types` perlu dikonfigurasi di tsconfig.json
- CSS warnings untuk @tailwind directives - normal untuk NativeWind

## 📚 Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native](https://reactnative.dev/)
- [NativeWind](https://www.nativewind.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Blueprint](./blueprint.md)

## 📄 License

Private project - All rights reserved

---

**Monetra v1.0.0** - Built with ❤️ for managing wedding savings
