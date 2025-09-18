// 1. Import package yang dibutuhkan
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Ini untuk memuat file .env

// 2. Konfigurasi awal
const app = express();
const port = process.env.PORT || 3001; // Menggunakan port dinamis

// Middleware
app.use(cors());
app.use(express.json()); // Agar express bisa membaca JSON dari body request

// 3. Koneksi ke Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 4. Endpoint Aplikasi

// Endpoint dasar untuk tes
app.get('/', (req, res) => {
  res.json({ message: 'Selamat datang di API Coffee Shop' });
});

// Endpoint untuk mengambil semua data produk (menu)
app.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*');

    if (error) throw error;
    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data produk' });
  }
});

// Endpoint yang dituju oleh QR Code untuk membuat sesi
app.get('/scan/meja/:tableNumber', async (req, res) => {
  try {
    const { tableNumber } = req.params;
    
    // Cek dulu apakah meja ada di database
    const { data: table, error: findError } = await supabase
      .from('tables')
      .select('table_number')
      .eq('table_number', tableNumber)
      .single();

    if (findError || !table) {
      return res.status(404).send('Meja tidak ditemukan.');
    }

    // Buat kode acak dan waktu kedaluwarsa
    const sessionCode = crypto.randomBytes(8).toString('hex');
    const expiresIn = 2 * 60 * 60 * 1000; // 2 jam dalam milidetik
    const sessionExpiresAt = new Date(Date.now() + expiresIn);

    // Simpan sesi ke database
    const { error: updateError } = await supabase
      .from('tables')
      .update({ session_code: sessionCode, session_expires_at: sessionExpiresAt })
      .eq('table_number', tableNumber);

    if (updateError) throw updateError;

    // === PERUBAHAN DI SINI ===
    // Menggunakan URL frontend dari environment variable, atau localhost sebagai cadangan
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/?meja=${tableNumber}&kode=${sessionCode}`);
  
  } catch (error) {
    res.status(500).send('Gagal membuat sesi: ' + error.message);
  }
});

// Endpoint untuk menerima dan memvalidasi pesanan baru
app.post('/api/orders', async (req, res) => {
  try {
    const { table_number, items, total_price, session_code } = req.body;

    // Validasi input
    if (!table_number || !items || items.length === 0 || !session_code) {
      return res.status(400).json({ error: 'Data pesanan tidak lengkap' });
    }

    // 1. Ambil data sesi dari database
    const { data: tableData, error: tableError } = await supabase
      .from('tables')
      .select('session_code, session_expires_at')
      .eq('table_number', table_number)
      .single();

    if (tableError || !tableData) {
      return res.status(404).json({ error: 'Meja tidak ditemukan' });
    }

    // 2. Validasi sesi
    if (tableData.session_code !== session_code) {
      return res.status(403).json({ error: 'Kode sesi tidak valid. Mungkin sudah ada yang memesan.' });
    }
    if (new Date(tableData.session_expires_at) < new Date()) {
      return res.status(403).json({ error: 'Sesi Anda telah kedaluwarsa. Silakan pindai ulang QR code.' });
    }
    
    // 3. PROSES PESANAN
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{ table_number, total_price, items }])
      .select();

    if (orderError) throw orderError;

    // 4. HANGUSKAN SESI
    await supabase
      .from('tables')
      .update({ session_code: null, session_expires_at: null })
      .eq('table_number', table_number);

    res.status(201).json({ message: 'Pesanan berhasil dibuat!', data: orderData });

  } catch (error) {
    res.status(500).json({ error: 'Gagal membuat pesanan', details: error.message });
  }
});


// 5. Menjalankan server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});