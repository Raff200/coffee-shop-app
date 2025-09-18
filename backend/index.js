// 1. Import package yang dibutuhkan
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Ini untuk memuat file .env

// 2. Konfigurasi awal
const app = express();
const port = 3001; // Kita akan menjalankan server di port 3001

// Middleware
app.use(cors());
app.use(express.json()); // Agar express bisa membaca JSON dari body request

// 3. Koneksi ke Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 4. Membuat "Route" atau "Endpoint" pertama
// Ini adalah alamat URL yang bisa diakses untuk mengetes server
app.get('/', (req, res) => {
  res.json({ message: 'Selamat datang di API Coffee Shop' });
});
// Endpoint untuk mengambil semua data produk (menu)
app.get('/api/products', async (req, res) => {
  try {
    // Menggunakan Supabase client untuk mengambil semua data (*) dari tabel 'products'
    const { data, error } = await supabase
      .from('products')
      .select('*');

    // Jika ada error saat mengambil data, kirim pesan error
    if (error) {
      throw error;
    }

    // Jika berhasil, kirim data produk sebagai response
    res.status(200).json(data);

  } catch (error) {
    // Tangkap error dan kirim response error ke client
    res.status(500).json({ error: 'Gagal mengambil data produk' });
  }
});
// Endpoint untuk menerima pesanan baru
app.post('/api/orders', async (req, res) => {
  try {
    const { table_number, items, total_price, session_code } = req.body;

    // --- VALIDASI KRUSIAL ---
    if (!table_number || !items || items.length === 0 || !session_code) {
      return res.status(400).json({ error: 'Data pesanan tidak lengkap' });
    }

    // 1. Ambil data sesi dari database untuk divalidasi
    const { data: tableData, error: tableError } = await supabase
      .from('tables')
      .select('session_code, session_expires_at')
      .eq('table_number', table_number)
      .single();

    if (tableError || !tableData) {
      return res.status(404).json({ error: 'Meja tidak ditemukan' });
    }

    // 2. Bandingkan kode sesi dan waktu kedaluwarsa
    if (tableData.session_code !== session_code) {
      return res.status(403).json({ error: 'Kode sesi tidak valid. Mungkin sudah ada yang memesan.' });
    }
    if (new Date(tableData.session_expires_at) < new Date()) {
      return res.status(403).json({ error: 'Sesi Anda telah kedaluwarsa. Silakan pindai ulang QR code.' });
    }

    // --- PROSES PESANAN (jika validasi lolos) ---
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{ table_number, total_price, items }])
      .select();

    if (orderError) throw orderError;

    // --- HANGUSKAN TIKET (setelah pesanan sukses) ---
    await supabase
      .from('tables')
      .update({ session_code: null, session_expires_at: null })
      .eq('table_number', table_number);

    res.status(201).json({ message: 'Pesanan berhasil dibuat!', data: orderData });

  } catch (error) {
    res.status(500).json({ error: 'Gagal membuat pesanan', details: error.message });
  }
});
// Endpoint yang dituju oleh QR Code untuk membuat sesi
app.get('/scan/meja/:tableNumber', async (req, res) => {
  try {
    const { tableNumber } = req.params;

    // 1. Buat kode acak dan waktu kedaluwarsa
    const sessionCode = crypto.randomBytes(8).toString('hex');
    const expiresIn = 2 * 60 * 60 * 1000; // 3 jam dalam milidetik
    const sessionExpiresAt = new Date(Date.now() + expiresIn);

    // 2. Simpan ke database
    const { error } = await supabase
      .from('tables')
      .update({ session_code: sessionCode, session_expires_at: sessionExpiresAt })
      .eq('table_number', tableNumber);

    if (error) throw error;

    // 3. Alihkan (redirect) browser pengguna ke halaman frontend dengan kode sesi
    // Ganti 'http://localhost:5173' dengan URL frontend Anda saat sudah online
    res.redirect(`http://localhost:5173/?meja=${tableNumber}&kode=${sessionCode}`);

  } catch (error) {
    res.status(500).send('Gagal membuat sesi: ' + error.message);
  }
});


// 5. Menjalankan server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});