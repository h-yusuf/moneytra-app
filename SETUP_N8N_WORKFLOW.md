# Setup Guide: n8n Workflow untuk Monetra

## 🎯 Arsitektur Hybrid: Sheets + Database

```
Mobile App → n8n Webhook → AI Extract → Google Sheets (Raw) → Transform → Supabase → Response
                                              ↓
                                        Audit Trail & Backup
```

## 📋 Prerequisites

1. **n8n Instance** (self-hosted atau n8n.cloud)
2. **Google Sheets** dengan OAuth credentials
3. **Supabase Project** atau PostgreSQL database
4. **DeepSeek API Key** (atau AI provider lainnya)

---

## 🔧 Step 1: Setup Google Sheets

### Buat Spreadsheet Baru

**Sheet 1: Raw_Extractions**
```
| timestamp | user_id | source_name | type | raw_ai_response | raw_text | status | db_id | processed_at |
```

**Sheet 2: Expense (Optional - untuk review manual)**
```
| created_at | user_id | merchant | category | total | payment_method | transaction_date | notes | verified |
```

**Sheet 3: Wedding_Savings (Optional)**
```
| created_at | user_id | merchant | total | payment_method | transaction_date | notes | verified |
```

### Get Spreadsheet ID
```
https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
                                        ^^^^^^^^^^^^^^^^
                                        Copy this ID
```

---

## 🗄️ Step 2: Setup Supabase Database

### Create Table

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('expense', 'wedding_savings')),
  source_name VARCHAR(255),
  transaction_date DATE,
  merchant VARCHAR(255),
  category VARCHAR(100),
  payment_method VARCHAR(50),
  total DECIMAL(15,2) NOT NULL,
  notes TEXT,
  file_url TEXT,
  sheets_row_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

### Get Supabase Credentials

1. Go to Project Settings → API
2. Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon/Public Key**: `eyJhbGc...`

---

## 🤖 Step 3: Get DeepSeek API Key

1. Sign up at https://platform.deepseek.com
2. Go to API Keys
3. Create new key
4. Copy: `sk-xxxxxxxxxxxxxxxx`

---

## 📦 Step 4: Import Workflow ke n8n

### Import File

1. Buka n8n
2. Click **"+"** → **Import from File**
3. Upload: `monetra-extract-fixed.json`
4. Click **Import**

### Setup Credentials

#### Google Sheets OAuth2

1. Click node **"Save Raw to Sheets"**
2. Click **"Create New Credential"**
3. Follow OAuth flow
4. Test connection

#### Environment Variables

Di n8n, set environment variables:

```env
DEEPSEEK_API_KEY=Bearer sk-your-deepseek-api-key
GOOGLE_SHEETS_ID=your-spreadsheet-id
GOOGLE_SHEETS_CREDENTIAL_ID=your-credential-id
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
```

**Cara set di n8n:**
- Self-hosted: Edit `.env` file atau docker-compose
- n8n.cloud: Settings → Environment Variables

---

## 🧪 Step 5: Testing Workflow

### Activate Workflow

1. Click **"Active"** toggle di workflow
2. Copy webhook URL: `https://your-n8n.com/webhook/extract-transaction`

### Test dengan cURL

```bash
curl -X POST https://your-n8n.com/webhook/extract-transaction \
  -H "Content-Type: application/json" \
  -d '{
    "type": "expense",
    "text": "Indomaret Rp 125.000 QRIS 16 Maret 2026 Belanja snack",
    "source_name": "IMG_1234.jpg",
    "user_id": "test-user-123"
  }'
```

### Expected Response

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
    "notes": "Belanja snack"
  },
  "sheets_row": 2,
  "db_id": "uuid-here"
}
```

### Verify Data

**Check Google Sheets:**
- Open Raw_Extractions sheet
- Should see new row with status "processed"

**Check Supabase:**
```sql
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 1;
```

---

## 🔄 Step 6: Integrate dengan Mobile App

### Update .env di App

```env
EXPO_PUBLIC_API_URL=https://your-n8n.com/webhook
```

### Update API Client

Edit `src/lib/api.ts`:

```typescript
export const extractTransaction = async (data: {
  type: 'expense' | 'wedding_savings';
  text: string;
  source_name?: string;
  user_id: string;
}) => {
  const response = await apiClient.post('/extract-transaction', data);
  return response.data;
};
```

### Usage di Upload Screen

```typescript
import { extractTransaction } from '@/src/lib/api';

const handleUpload = async (imageUri: string, type: TransactionType) => {
  try {
    // 1. Extract text dari image (OCR)
    const text = await performOCR(imageUri);
    
    // 2. Send to n8n for AI extraction
    const result = await extractTransaction({
      type,
      text,
      source_name: imageUri.split('/').pop(),
      user_id: currentUser.id
    });
    
    // 3. Navigate to review screen
    router.push({
      pathname: '/transaction/review',
      params: { data: JSON.stringify(result.data) }
    });
  } catch (error) {
    console.error('Extraction failed:', error);
  }
};
```

---

## 🎨 Bonus: Dashboard untuk Monitor

### Create Monitoring Sheet

**Sheet: Extraction_Stats**
```
| date | total_extractions | success_rate | avg_processing_time | errors |
```

### Add Monitoring Node (Optional)

Tambahkan di akhir workflow untuk log statistics.

---

## 🔍 Troubleshooting

### Issue: "Gagal parse JSON dari AI"

**Cause:** AI response tidak valid JSON

**Fix:**
1. Check DeepSeek API key
2. Increase temperature di AI call (0.2 → 0.3)
3. Add retry logic

### Issue: "Google Sheets quota exceeded"

**Cause:** Too many requests

**Fix:**
1. Add rate limiting
2. Batch processing
3. Use Supabase directly for high volume

### Issue: "Supabase connection failed"

**Cause:** Wrong credentials atau RLS policy

**Fix:**
1. Verify SUPABASE_URL dan SUPABASE_ANON_KEY
2. Check RLS policies di Supabase
3. Enable anon access untuk insert

---

## 📊 Performance Tips

### 1. Batch Processing

Untuk volume tinggi, buat workflow terpisah:
```
Trigger: Schedule (every 5 minutes)
→ Read pending rows from Sheets
→ Batch process to Database
→ Update status
```

### 2. Caching

Cache kategori dan merchant suggestions di Redis/Memory.

### 3. Async Processing

Untuk real-time UX:
```
App → n8n (return immediately)
      ↓
    Background processing
      ↓
    Webhook callback to app
```

---

## 🚀 Production Checklist

- [ ] Setup n8n with proper authentication
- [ ] Enable HTTPS for webhook
- [ ] Setup error notifications (email/Slack)
- [ ] Add retry logic untuk failed extractions
- [ ] Setup backup untuk Google Sheets
- [ ] Monitor API usage (DeepSeek quota)
- [ ] Add logging untuk debugging
- [ ] Setup rate limiting
- [ ] Test dengan berbagai format struk
- [ ] Document common extraction patterns

---

## 📞 Support

Jika ada masalah:
1. Check n8n execution logs
2. Verify Google Sheets data
3. Check Supabase logs
4. Test AI extraction manually

---

**Happy Extracting! 🎉**
