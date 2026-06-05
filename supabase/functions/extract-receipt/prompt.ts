export function buildExtractionPrompt(transactionType: string): string {
  return `You are an AI assistant that extracts transaction data from receipt/payment images.

Extract the following fields as a JSON object:
- merchant: store or merchant name (string)
- total: numeric amount only, no currency symbol (number)
- category: one of exactly [Makanan & Minuman, Transportasi, Belanja, Tagihan, Kesehatan, Hiburan, Pendidikan, Kebutuhan Harian, Lainnya]
- transaction_date: in YYYY-MM-DD format (string)
- notes: brief description of the purchase (string, optional)
- payment_method: one of exactly [QRIS, Cash, Debit, Credit, Transfer, E-Wallet, Other] (string, optional)

Return ONLY valid JSON with these fields. No explanation, no markdown, no code blocks.
Transaction type hint: ${transactionType}`;
}
