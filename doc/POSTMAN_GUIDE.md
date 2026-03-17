# Postman Testing Guide untuk Monetra API

## 📦 Import Collection

### Step 1: Import ke Postman

1. Buka Postman
2. Click **Import** button
3. Pilih file: `Monetra_API.postman_collection.json`
4. Click **Import**

### Step 2: Setup Environment

1. Click **Environments** (kiri sidebar)
2. Click **+** untuk create new environment
3. Nama: `Monetra - Development`
4. Add variable:

```
Variable: base_url
Initial Value: https://your-n8n-instance.com
Current Value: https://your-n8n-instance.com
```

5. Click **Save**
6. Select environment dari dropdown (kanan atas)

---

## 🧪 Test Scenarios

### 1. Basic Extraction Tests

#### Test 1.1: Extract Expense - Indomaret
**Purpose:** Test basic expense extraction

**Request:**
```json
{
  "type": "expense",
  "text": "Indomaret Rp 125.000 QRIS 16 Maret 2026 Belanja snack dan minuman",
  "source_name": "IMG_1234.jpg",
  "user_id": "test-user-123"
}
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
    "notes": "Belanja snack dan minuman"
  },
  "sheets_row": 2,
  "db_id": "uuid-here"
}
```

**Verify:**
- ✅ `type` is "expense"
- ✅ `total` is number (125000)
- ✅ `merchant` extracted correctly
- ✅ `payment_method` is "QRIS"
- ✅ `transaction_date` in YYYY-MM-DD format
- ✅ `sheets_row` exists
- ✅ `db_id` is UUID

---

#### Test 1.2: Extract Wedding Savings
**Purpose:** Test wedding savings extraction

**Request:**
```json
{
  "type": "wedding_savings",
  "text": "Transfer ke Tabungan Nikah\nBank Mandiri\nJumlah: Rp 5.000.000\nTanggal: 16 Maret 2026",
  "source_name": "transfer_mandiri.jpg",
  "user_id": "couple-001"
}
```

**Expected Response:**
```json
{
  "success": true,
  "source_name": "transfer_mandiri.jpg",
  "data": {
    "type": "wedding_savings",
    "total": 5000000,
    "merchant": "Bank Mandiri",
    "category": "Tabungan",
    "payment_method": "Transfer",
    "transaction_date": "2026-03-16",
    "notes": "Nabung bulan Maret"
  },
  "sheets_row": 3,
  "db_id": "uuid-here"
}
```

**Verify:**
- ✅ `type` is "wedding_savings"
- ✅ `category` is "Tabungan"
- ✅ Large amount handled correctly

---

### 2. Complex Receipt Tests

#### Test 2.1: Multi-Item Receipt
**Purpose:** Test extraction dari struk dengan banyak item

**Request:** Lihat "Extract Expense - Complex Receipt" di collection

**Expected Behavior:**
- AI should extract total amount (Rp 190.000)
- Should identify merchant (Transmart Carrefour)
- Should recognize payment method (Cash)
- Should extract correct date

---

### 3. Error Handling Tests

#### Test 3.1: Missing Type
**Expected Response:**
```json
{
  "error": "type harus expense atau wedding_savings"
}
```

#### Test 3.2: Invalid Type
**Expected Response:**
```json
{
  "error": "type harus expense atau wedding_savings"
}
```

#### Test 3.3: Missing Text
**Expected Response:**
```json
{
  "error": "text wajib diisi"
}
```

---

### 4. Edge Cases Tests

#### Test 4.1: Minimal Data
**Request:**
```json
{
  "type": "expense",
  "text": "Warteg 25rb",
  "source_name": "manual",
  "user_id": "user-minimal"
}
```

**Expected Behavior:**
- Should extract amount (25000)
- Merchant might be "Warteg" or empty
- Other fields should be empty strings
- Should NOT fail

---

#### Test 4.2: No Date in Text
**Expected Behavior:**
- `transaction_date` should be today's date (YYYY-MM-DD)

---

#### Test 4.3: Large Amount
**Request:** See "Extract with Large Amount"

**Expected Behavior:**
- Should handle Rp 50.000.000 correctly
- No number overflow
- Stored as decimal in database

---

## 📊 Verification Checklist

### After Each Test:

#### 1. Check Response
- [ ] Status code is 200
- [ ] `success` is true
- [ ] All required fields present
- [ ] Field types correct (number for total, string for others)

#### 2. Check Google Sheets
- [ ] New row added to "Raw_Extractions"
- [ ] `status` is "processed"
- [ ] `raw_ai_response` contains valid JSON
- [ ] `timestamp` is correct

#### 3. Check Supabase
```sql
SELECT * FROM transactions 
WHERE source_name = 'IMG_1234.jpg' 
ORDER BY created_at DESC 
LIMIT 1;
```

- [ ] Record exists
- [ ] `total` is correct type (decimal)
- [ ] `transaction_date` is date type
- [ ] `sheets_row_id` matches Sheets row

---

## 🔍 Debugging Tips

### If Response is Slow (>5s)
1. Check DeepSeek API status
2. Verify network connection
3. Check n8n execution logs

### If Extraction is Wrong
1. Check AI prompt in workflow
2. Verify temperature setting (should be 0.2)
3. Test with simpler text first

### If Database Insert Fails
1. Check Supabase credentials
2. Verify table schema
3. Check RLS policies
4. Look at Supabase logs

### If Sheets Update Fails
1. Check Google Sheets credentials
2. Verify sheet name matches
3. Check quota limits

---

## 📈 Performance Benchmarks

### Expected Response Times:
- Simple extraction: 2-4 seconds
- Complex receipt: 4-6 seconds
- With database save: +1-2 seconds

### Success Rate:
- Simple receipts: >95%
- Complex receipts: >85%
- Handwritten notes: ~70%

---

## 🚀 Automation Testing

### Newman (CLI)

Install Newman:
```bash
npm install -g newman
```

Run collection:
```bash
newman run Monetra_API.postman_collection.json \
  --environment Monetra-Dev.postman_environment.json \
  --reporters cli,json \
  --reporter-json-export results.json
```

### CI/CD Integration

Add to GitHub Actions:
```yaml
- name: Run API Tests
  run: |
    newman run Monetra_API.postman_collection.json \
      --environment Monetra-Dev.postman_environment.json \
      --bail
```

---

## 📝 Test Data Examples

### Indonesian Receipt Formats

**Format 1: Minimarket**
```
INDOMARET
Jl. Sudirman No. 123
16/03/2026 14:30

Aqua 600ml      Rp  5.000
Indomie Goreng  Rp  3.500
Teh Pucuk       Rp  4.000
----------------------------
Total           Rp 12.500
Tunai           Rp 20.000
Kembali         Rp  7.500

QRIS - BCA
```

**Format 2: Restaurant**
```
WARUNG PADANG SEDERHANA
Nasi Padang     Rp 25.000
Es Teh          Rp  5.000
----------------------------
Subtotal        Rp 30.000
PB1 10%         Rp  3.000
----------------------------
TOTAL           Rp 33.000

Cash
16 Maret 2026
```

**Format 3: Online Transfer**
```
BCA Mobile
Transfer Berhasil

Ke: TOKOPEDIA
Jumlah: Rp 250.000
Tanggal: 16/03/2026 15:45
Ref: TRX123456789
Keterangan: Belanja online
```

---

## ✅ Pre-Production Checklist

Before going to production:

- [ ] All test scenarios pass
- [ ] Error handling works correctly
- [ ] Database saves successfully
- [ ] Sheets audit trail works
- [ ] Response time acceptable (<5s)
- [ ] Large amounts handled correctly
- [ ] Special characters work
- [ ] Multiple date formats recognized
- [ ] Edge cases handled gracefully
- [ ] API key secured (not in code)

---

**Happy Testing! 🧪**
