// Node: Pisah Data Sensitive (Simplified)
// Input: $json.text dari node "Image to Text" atau "PDF to Text"
// Output: { rawText: string }
// 
// Fungsi: Menyiapkan teks hasil OCR struk/bukti pembayaran untuk dikirim ke AI Agent
// AI Agent yang akan mengekstrak: merchant, total, tanggal, metode pembayaran, dll

function cleanText(text) {
  if (!text) return '';
  
  // Normalisasi spasi dan line breaks
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractBasicInfo(text) {
  // Ekstrak info dasar yang bisa diidentifikasi dengan pattern sederhana
  const info = {
    hasTotal: false,
    hasDate: false,
    hasMerchant: false
  };
  
  // Cek apakah ada total/harga
  if (/(?:total|jumlah|bayar|amount|price)[:\s]*(?:Rp\.?|IDR)?\s*[\d.,]+/i.test(text)) {
    info.hasTotal = true;
  }
  
  // Cek apakah ada tanggal
  if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)/i.test(text)) {
    info.hasDate = true;
  }
  
  // Cek apakah ada nama merchant/toko
  if (text.split('\n').length > 2) {
    info.hasMerchant = true;
  }
  
  return info;
}

// Main processing
const inputText = $json.text || '';
const cleanedText = cleanText(inputText);
const basicInfo = extractBasicInfo(cleanedText);

return {
  rawText: cleanedText,
  meta: {
    hasTotal: basicInfo.hasTotal,
    hasDate: basicInfo.hasDate,
    hasMerchant: basicInfo.hasMerchant,
    textLength: cleanedText.length,
    lineCount: cleanedText.split('\n').length
  }
};
