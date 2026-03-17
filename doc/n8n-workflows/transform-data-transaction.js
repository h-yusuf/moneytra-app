// Node: Transform Data (Transaction)
// Input: $input.first().json.output dari AI Agent
// Output: Clean JSON object ready for Supabase

const raw = $input.first().json.output || '';

// 1. Remove code block syntax like ```json ... ```
const cleaned = raw.replace(/```json|```/g, '').trim();

// 2. Parse JSON
const parsed = JSON.parse(cleaned);

// 3. Get additional data from previous nodes if needed
// Assuming we have user_id and source_name from earlier in the workflow
const user_id = $("Webhook File upload").first().json.body?.user_id || 'default-user';
const source_name = $("Webhook File upload").first().json.body?.source_name || 'uploaded-receipt';

// 4. Build final transaction object for Supabase
const transaction = {
  user_id: user_id,
  type: 'expense', // Default to expense for receipt uploads
  source_name: source_name,
  merchant: parsed.merchant || null,
  total: parsed.total || null,
  transaction_date: parsed.transaction_date || null,
  payment_method: parsed.payment_method || null,
  category: parsed.category || 'Lainnya',
  notes: parsed.notes || ''
};

// 5. Validate required fields
if (!transaction.total || transaction.total <= 0) {
  throw new Error('Total amount is required and must be greater than 0');
}

if (!transaction.transaction_date) {
  throw new Error('Transaction date is required');
}

return [{ json: transaction }];
