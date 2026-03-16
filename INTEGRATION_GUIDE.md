# Panduan Integrasi n8n Workflow dengan Monetra App

## Masalah yang Ditemukan

### 1. Type Naming Mismatch
- **Workflow:** `money_saving`
- **App:** `wedding_savings`
- **Fix:** Ubah semua `money_saving` ke `wedding_savings` di workflow

### 2. Field Naming Mismatch

#### Current Workflow Output:
```json
{
  "type": "expense",
  "amount": 0,
  "description": "",
  "category": "",
  "date": "",
  "merchant": "",
  "payment_method": "",
  "notes": ""
}
```

#### App Expected Format:
```json
{
  "type": "expense",
  "total": 0,
  "merchant": "",
  "category": "",
  "payment_method": "",
  "transaction_date": "",
  "notes": ""
}
```

### 3. Storage Backend Mismatch
- **Workflow:** Google Sheets
- **App:** PostgreSQL/Supabase (sesuai blueprint)

## Solusi yang Direkomendasikan

### Option 1: Modifikasi Workflow n8n (Recommended)

#### A. Update AI Prompts

**Expense Prompt (Node 4):**
```
Ekstrak transaksi berikut menjadi JSON valid.

Kategori transaksi: expense

Aturan:
- Kembalikan HANYA JSON
- Jangan tambahkan penjelasan
- Jika tidak yakin, isi string kosong
- total harus angka tanpa pemisah ribuan
- transaction_date format YYYY-MM-DD jika bisa dikenali
- type harus selalu "expense"

Format JSON:
{
  "type": "expense",
  "total": 0,
  "merchant": "",
  "category": "",
  "payment_method": "",
  "transaction_date": "",
  "notes": ""
}

Teks transaksi:
{{$json.text}}
```

**Wedding Savings Prompt (Node 5):**
```
Ekstrak transaksi berikut menjadi JSON valid.

Kategori transaksi: wedding_savings

Aturan:
- Kembalikan HANYA JSON
- Jangan tambahkan penjelasan
- Jika tidak yakin, isi string kosong
- total harus angka tanpa pemisah ribuan
- transaction_date format YYYY-MM-DD jika bisa dikenali
- type harus selalu "wedding_savings"

Format JSON:
{
  "type": "wedding_savings",
  "total": 0,
  "merchant": "",
  "category": "Tabungan",
  "payment_method": "",
  "transaction_date": "",
  "notes": ""
}

Teks transaksi:
{{$json.text}}
```

#### B. Update Validation (Node 2)

```javascript
const body = $json.body ?? $json;

const type = String(body.type || '').trim().toLowerCase();
const text = String(body.text || '').trim();
const source_name = String(body.source_name || 'manual input').trim();

// Update validation untuk wedding_savings
if (!['expense', 'wedding_savings'].includes(type)) {
  throw new Error('type harus expense atau wedding_savings');
}

if (!text) {
  throw new Error('text wajib diisi');
}

return [{ json: { type, text, source_name } }];
```

#### C. Update Switch Nodes (Node 3 & 9)

Ganti semua kondisi `money_saving` dengan `wedding_savings`

#### D. Replace Google Sheets dengan Supabase/PostgreSQL

**Option D1: Gunakan Supabase (Recommended)**

1. Install Supabase node di n8n
2. Replace nodes 10 & 11 dengan Supabase Insert
3. Table schema:

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('expense', 'wedding_savings')),
  source_name VARCHAR(255),
  transaction_date DATE,
  merchant VARCHAR(255),
  category VARCHAR(100),
  payment_method VARCHAR(50),
  total DECIMAL(15,2) NOT NULL,
  notes TEXT,
  file_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Option D2: Gunakan HTTP Request ke FastAPI**

Replace Google Sheets nodes dengan HTTP Request:

```json
{
  "method": "POST",
  "url": "{{$env.BACKEND_URL}}/transactions",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{$env.API_TOKEN}}"
  },
  "body": {
    "user_id": "{{$json.user_id}}",
    "type": "{{$json.data.type}}",
    "source_name": "{{$json.source_name}}",
    "transaction_date": "{{$json.data.transaction_date}}",
    "merchant": "{{$json.data.merchant}}",
    "category": "{{$json.data.category}}",
    "payment_method": "{{$json.data.payment_method}}",
    "total": "{{$json.data.total}}",
    "notes": "{{$json.data.notes}}"
  }
}
```

### Option 2: Modifikasi App Frontend (Not Recommended)

Ubah types di app untuk match workflow - **TIDAK DIREKOMENDASIKAN** karena:
- Blueprint sudah final
- Lebih mudah ubah workflow daripada refactor app
- `wedding_savings` lebih deskriptif daripada `money_saving`

## Langkah Implementasi

### 1. Update Workflow n8n

```bash
# Import workflow yang sudah dimodifikasi ke n8n
# File: monetra-extract-transaction-fixed.json
```

### 2. Setup Environment Variables di n8n

```env
DEEPSEEK_API_KEY=sk-your-api-key
BACKEND_URL=http://localhost:8000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

### 3. Update App .env

```env
EXPO_PUBLIC_API_URL=https://your-n8n-instance.com
```

### 4. Test Flow

**Request dari App:**
```bash
curl -X POST https://your-n8n.com/webhook/extract-transaction \
  -H "Content-Type: application/json" \
  -d '{
    "type": "expense",
    "text": "Indomaret Rp 125.000 QRIS 16 Maret 2026",
    "source_name": "IMG_1234.jpg"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "source_name": "IMG_1234.jpg",
  "data": {
    "type": "expense",
    "total": 125000,
    "merchant": "Indomaret",
    "category": "Kebutuhan Harian",
    "payment_method": "QRIS",
    "transaction_date": "2026-03-16",
    "notes": ""
  }
}
```

## Checklist Integrasi

- [ ] Update type `money_saving` → `wedding_savings` di workflow
- [ ] Update field names: `amount` → `total`, `date` → `transaction_date`
- [ ] Remove field `description` dari AI prompt
- [ ] Update validation logic
- [ ] Replace Google Sheets dengan Supabase/PostgreSQL
- [ ] Setup environment variables
- [ ] Test extraction endpoint
- [ ] Integrate dengan app upload flow
- [ ] Add error handling
- [ ] Add user authentication

## API Contract untuk App

### Endpoint
```
POST /webhook/extract-transaction
```

### Request Body
```typescript
{
  type: 'expense' | 'wedding_savings';
  text: string;
  source_name?: string;
}
```

### Response
```typescript
{
  success: boolean;
  source_name: string;
  data: {
    type: 'expense' | 'wedding_savings';
    total: number;
    merchant: string;
    category: string;
    payment_method: string;
    transaction_date: string;
    notes: string;
  };
  error?: string;
}
```

## Next Steps

1. **Buat workflow yang sudah difix** dengan perubahan di atas
2. **Deploy n8n** (self-hosted atau n8n.cloud)
3. **Setup Supabase** atau PostgreSQL database
4. **Update app** untuk call endpoint n8n
5. **Implementasi review screen** di app untuk edit hasil extraction
6. **Add authentication** untuk secure endpoint
