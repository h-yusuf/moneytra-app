# Monetra — System Flow SEBELUM Migrasi ke Supabase

**Status:** Arsitektur lama (referensi). Digantikan oleh migrasi Supabase — lihat [2026-06-05-supabase-migration.md](../superpowers/plans/2026-06-05-supabase-migration.md).

> **Catatan migrasi:** Google Sheets **dipertahankan** sebagai realtime monitoring dashboard. Pada arsitektur baru, save transaksi lewat Edge Function `create-transaction` yang dual-write ke Supabase Postgres + Google Sheets secara bersamaan.

**Stack lama:** React Native App → Axios → n8n Webhooks → Supabase REST API / Google Sheets / DeepSeek AI

---

## 1. Overview Arsitektur

```mermaid
graph LR
    subgraph APP["Mobile App (React Native + Expo)"]
        IDX["index.tsx\nDashboard"]
        HIST["history.tsx"]
        EXPLORE["explore.tsx"]
        ADD["add.tsx"]
        LAYOUT["_layout.tsx\nAppInitializer"]
        AXIOS["src/lib/api.ts\nAxios client"]
    end

    subgraph N8N["n8n (n8n.pullstack.cloud)"]
        WH_OCR["POST /webhook/uploadDoc"]
        WH_EXTRACT["POST /webhook/extract-transaction"]
        WH_TXN["GET /webhook/transactions"]
        WH_REPORT["GET /webhook/report/monthly"]
        WH_SPENDING["GET /webhook/report/spending-overview"]
        WH_TOKEN["POST /webhook/register-token"]
    end

    subgraph DB["Supabase Postgres"]
        TBL["TABLE: transactions"]
        V1["VIEW: spending_overview"]
        V2["VIEW: transaction_periods"]
    end

    SHEETS["Google Sheets\n(audit trail)"]
    DEEPSEEK["DeepSeek API\ndeepseek-chat"]

    IDX --> AXIOS
    HIST --> AXIOS
    EXPLORE --> AXIOS
    ADD --> AXIOS
    LAYOUT --> AXIOS

    AXIOS --> WH_OCR
    AXIOS --> WH_EXTRACT
    AXIOS --> WH_TXN
    AXIOS --> WH_REPORT
    AXIOS --> WH_SPENDING
    AXIOS --> WH_TOKEN

    WH_OCR --> DEEPSEEK
    WH_EXTRACT --> DEEPSEEK
    WH_EXTRACT --> SHEETS
    WH_EXTRACT --> TBL
    WH_TXN --> TBL
    WH_REPORT --> TBL
    WH_SPENDING --> V1
    WH_TOKEN --> TBL
```

---

## 2. Upload & OCR Flow

**Endpoint:** `POST /webhook/uploadDoc`

```mermaid
sequenceDiagram
    actor User
    participant App as add.tsx
    participant n8n as n8n Workflow
    participant AI as DeepSeek / Gemini

    User->>App: Pilih / foto struk
    App->>App: setUploadedFile(uri, type, name)
    User->>App: Tap "Extract Data"
    App->>n8n: POST /webhook/uploadDoc\nFormData: { file, user_id, transaction_type }\ntimeout: 60s
    n8n->>n8n: Baca binary file
    n8n->>n8n: Convert ke base64
    n8n->>AI: POST (multimodal)\nimage base64 + prompt ekstraksi
    AI-->>n8n: Raw JSON response
    n8n->>n8n: Parse JSON\nnormalize field names
    n8n-->>App: { merchant, total, category,\ntransaction_date, notes, payment_method }
    App->>App: setExtractedData(result)
    App->>User: Tampilkan form review (editable)
    User->>App: Edit jika perlu → tap "Save"
    App->>n8n: POST /webhook/extract-transaction\n(createTransaction flow)
```

---

## 3. Extract & Save Transaction Flow

**Endpoint:** `POST /webhook/extract-transaction`

```mermaid
flowchart TD
    A["App: add.tsx\nhandle Save"] -->|"POST /webhook/extract-transaction\n{user_id, type, text, source_name}"| B

    subgraph N8N["n8n Workflow: Monetra - Extract Transaction"]
        B["[1] Webhook\nextract-transaction"] --> C
        C["[2] Validate Input\nCode Node\ntype ∈ expense/money_saving\ntext tidak kosong"] --> D

        D{{"[3] Switch\nTransaction Type"}}
        D -->|expense| E["[4a] Set Expense Prompt\ntype: expense"]
        D -->|money_saving| F["[4b] Set Wedding Savings Prompt\ntype: money_saving"]

        E --> G
        F --> G
        G["[5] Call AI DeepSeek\nPOST api.deepseek.com\nmodel: deepseek-chat\ntemp: 0.2"] --> H

        H["[6] Parse AI Response\nJSON.parse(choices[0])\nExtract JSON from braces"]

        H --> I{{"[7] Parse OK?"}}
        I -->|yes| J
        I -->|no| ERR["Return\n{success: false, error}"]

        J["[8a] Save to Google Sheets\nAppend row ke sheet Expense\natau Wedding_Savings\n→ dapat sheets_row_id"] --> K
        K["[8b] Save to Supabase\nPOST /rest/v1/transactions\nauth: service_role_key\n→ dapat db.id UUID"] --> L
        L["[9] Format Response\n{success, data, sheets_row, db_id}"] --> M
        M["[10] Respond to Webhook"]
    end

    M -->|"{ success, source_name,\ndata: {type, total, merchant...},\ndb_id: uuid }"| N["App: show success modal\nreset form setelah 2.5s"]
```

---

## 4. Get Transactions Flow

**Endpoint:** `GET /webhook/transactions`

```mermaid
sequenceDiagram
    participant App as history.tsx / index.tsx
    participant n8n as n8n Workflow
    participant SB as Supabase REST API

    App->>n8n: GET /webhook/transactions\n?user_id=xxx&type=expense&limit=100
    n8n->>n8n: Parse query params\ndefault limit=50 offset=0
    n8n->>n8n: Build URL:\n/rest/v1/transactions\n?order=created_at.desc\n&user_id=eq.xxx\n&type=eq.expense
    n8n->>SB: GET built URL\nHeaders: apikey + Authorization\n(service_role_key)
    SB-->>n8n: Transaction array
    n8n->>n8n: Wrap response:\n{ success: true, count: N, data: [...] }
    n8n-->>App: GetTransactionsResponse
    App->>App: setTransactions(response.data)
```

---

## 5. Monthly Report Flow

**Endpoint:** `GET /webhook/report/monthly`

```mermaid
flowchart TD
    A["App: index.tsx / explore.tsx"] -->|"GET /webhook/report/monthly\n?user_id=xxx&year=2026&month=6"| B

    subgraph N8N["n8n Workflow: Monetra - Get Monthly Report"]
        B["[1] Webhook Monthly Report"] --> C
        C["[2] Parse Params\nuser_id required\nyear / month optional"] --> D
        D["[3] Build Supabase URL\n/rest/v1/transactions\n?user_id=eq.xxx\n&select=type,total,transaction_date,category\n&transaction_date range filter"] --> E
        E["[4] HTTP GET → Supabase REST\nservice_role_key"] --> F
        F["[5] Calculate Report (Code Node)\n─ total_expense\n─ total_money_saving\n─ monthly_report[] group by YYYY-MM\n─ category_breakdown[] group by category"] --> G
        G["[6] Respond\nMonthlyReportResponse"]
    end

    G -->|"{ summary: {total_expense,\ntotal_money_saving,\ntotal_transactions},\nmonthly_report: [...],\ncategory_breakdown: [...] }"| H["App: render cards + charts"]
```

---

## 6. Spending Overview Flow

**Endpoint:** `GET /webhook/report/spending-overview`

```mermaid
sequenceDiagram
    participant App as explore.tsx
    participant n8n as n8n Workflow
    participant SB as Supabase View

    App->>n8n: GET /webhook/report/spending-overview\n?year=2026
    n8n->>SB: SELECT * FROM spending_overview\nWHERE period BETWEEN\n'2026-01-01' AND '2026-12-31'
    note over SB: VIEW spending_overview:\nSELECT date_trunc('month', transaction_date) AS period,\nuser_id,\nSUM(total) FILTER (WHERE type='expense') AS total_expense,\nSUM(total) FILTER (WHERE type='money_saving') AS total_income\nFROM transactions GROUP BY period, user_id
    SB-->>n8n: [{ period, user_id, total_expense, total_income }]
    n8n-->>App: SpendingOverviewRecord[]
    App->>App: Map user_id → color\nuser[0] = pink #FF6B8A\nuser[1] = teal #4ECDC4
    App->>App: Render couple comparison chart
```

---

## 7. Register Push Token Flow

**Endpoint:** `POST /webhook/register-token`

```mermaid
sequenceDiagram
    participant Layout as _layout.tsx\nAppInitializer
    participant NCtx as NotificationContext
    participant Expo as Expo Notifications
    participant AS as AsyncStorage
    participant n8n as n8n Workflow
    participant SB as Supabase

    Layout->>NCtx: requestPermissionAndRegister(userId)\nonce per session
    NCtx->>Expo: requestPermissionsAsync()
    Expo-->>NCtx: permission granted/denied
    NCtx->>Expo: getExpoPushTokenAsync()\n{ projectId }
    Expo-->>NCtx: ExponentPushToken[xxxxxxxx]
    NCtx->>AS: setItem('@push_token', token)
    NCtx->>n8n: POST /webhook/register-token\n{ user_id, push_token }
    n8n->>n8n: Validate:\nuser_id dan push_token tidak kosong
    n8n->>SB: POST /rest/v1/push_tokens\n{ user_id, token: push_token }\nPrefer: resolution=merge-duplicates
    SB-->>n8n: upserted row
    n8n-->>NCtx: { success: true }
```

---

## 8. Semua Endpoint n8n

| Endpoint | Method | Input | Output | Storage |
|---|---|---|---|---|
| `/webhook/uploadDoc` | POST | `FormData(file, user_id, transaction_type)` | `ExtractedTransactionData` | — stateless |
| `/webhook/extract-transaction` | POST | `{user_id, type, text, source_name}` | `{success, data, db_id}` | Google Sheets + Supabase |
| `/webhook/transactions` | GET | `?user_id&type&limit&offset` | `{success, count, data[]}` | Read Supabase |
| `/webhook/report/monthly` | GET | `?user_id&year&month` | `MonthlyReportResponse` | Read Supabase |
| `/webhook/report/spending-overview` | GET | `?year&month` | `SpendingOverviewRecord[]` | Read Supabase view |
| `/webhook/register-token` | POST | `{user_id, push_token}` | `{success}` | Upsert Supabase |

---

## 9. Masalah Arsitektur Lama

```mermaid
graph TD
    P1["❌ Double hop\nApp → n8n → Supabase REST\nCRUD sederhana lewat 2 layer"]
    P2["❌ n8n sebagai reverse proxy\nget-transactions & get-monthly-report\nhanya forward ke Supabase REST\ntanpa tambahan logic"]
    P3["❌ AI parse dua kali\n/uploadDoc → JSON ✓\nLalu createTransaction kirim text\nn8n AI parse lagi"]
    P4["❌ Google Sheets dependency\nSetiap extract-transaction\nwajib append Sheets\nQuota habis = flow gagal"]
    P5["❌ Service role key di n8n\nBypass semua RLS\nKalau n8n compromise\nseluruh DB exposed"]
    P6["❌ No authentication\nuser_id plain string\ndi body/query\nBisa impersonate user lain"]
    P7["❌ Single point of failure\nSemua feature depend\nke n8n.pullstack.cloud\nn8n down = app down"]
```

---

## 10. Sebelum vs Sesudah Migrasi

```mermaid
graph LR
    subgraph BEFORE["SEBELUM (n8n)"]
        B1["App → n8n → Supabase REST"]
        B2["n8n compute + forward report"]
        B3["n8n multimodal AI (OCR)"]
        B4["n8n → Supabase REST push token"]
        B5["Google Sheets required"]
        B6["Service role key di n8n"]
        B7["AI parse 2x per transaksi"]
        B8["Axios HTTP client"]
    end

    subgraph AFTER["SESUDAH (Supabase)"]
        A1["App → Supabase JS langsung"]
        A2["Client-side dari raw data + views"]
        A3["Supabase Edge Function\nGemini/OpenAI/Groq"]
        A4["supabase.upsert() langsung"]
        A5["Google Sheets dipertahankan\n(monitoring realtime)\ntulis via Edge Fn create-transaction"]
        A6["Key hanya di Edge Fn secrets"]
        A7["1x AI call, return langsung"]
        A8["Supabase JS SDK"]
        A9["Edge Fn create-transaction\ndual-write:\nSupabase + Google Sheets serentak"]
    end

    B1 -.->|migrated| A1
    B2 -.->|migrated| A2
    B3 -.->|migrated| A3
    B4 -.->|migrated| A4
    B5 -.->|retained as monitoring| A5
    B6 -.->|secured| A6
    B7 -.->|fixed| A7
    B8 -.->|replaced| A8
    A5 --- A9
```
