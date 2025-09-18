<script setup>
import { ref, onMounted, computed } from 'vue';

// --- State (Penyimpanan Data) ---
const products = ref([]);
const cart = ref([]);
const tableNumber = ref(null);
const sessionCode = ref(null);

// --- Computed Property (Data Turunan) ---
const totalPrice = computed(() => {
  return cart.value.reduce((total, item) => total + (item.price * item.quantity), 0);
});

// --- Functions (Aksi Pengguna) ---
function addToCart(product) {
  const itemInCart = cart.value.find(item => item.id === product.id);
  if (itemInCart) {
    itemInCart.quantity++;
  } else {
    cart.value.push({ ...product, quantity: 1 });
  }
}

async function placeOrder() {
  // Validasi nomor meja
  if (!tableNumber.value || !sessionCode.value) {
    alert("Nomor meja atau sesi tidak valid! Silakan pindai ulang QR Code di meja Anda.");
    return;
  }
  
  if (cart.value.length === 0) {
    alert("Keranjang masih kosong!");
    return;
  }

  // Objek data yang akan dikirim ke backend
  const orderData = {
    table_number: tableNumber.value,
    items: cart.value,
    total_price: totalPrice.value,
    session_code: sessionCode.value
  };

  try {
    const response = await fetch('http://localhost:3001/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    const result = await response.json();

    if (!response.ok) {
      // Menampilkan pesan error dari backend jika ada
      throw new Error(result.error || 'Gagal mengirim pesanan');
    }
    
    alert('Pesanan Anda berhasil dibuat untuk meja no. ' + tableNumber.value);
    console.log(result);
    cart.value = []; // Kosongkan keranjang setelah berhasil

  } catch (error) {
    console.error('Error:', error);
    alert('Terjadi kesalahan: ' + error.message);
  }
}

// --- Lifecycle Hook ---
onMounted(async () => {
  // Pertama, baca parameter dari URL
  const urlParams = new URLSearchParams(window.location.search);
  const mejaValue = urlParams.get('meja');
  const kodeValue = urlParams.get('kode');

  if (mejaValue) {
    tableNumber.value = mejaValue;
  }
  if (kodeValue) {
    sessionCode.value = kodeValue;
  }
  
  // Kedua, ambil data produk (di dalam onMounted yang sama)
  try {
    const response = await fetch('http://localhost:3001/api/products');
    const data = await response.json();
    products.value = data;
  } catch (error) {
    console.error('Gagal mengambil data produk:', error);
  }
});
</script>

<template>
  <div class="menu-container">
    <h1 v-if="tableNumber">Pesanan untuk Meja No. {{ tableNumber }}</h1>
    <h1>Menu Kami</h1>
    
    <div v-if="products.length > 0" class="product-list">
      <div v-for="product in products" :key="product.id" class="product-card">
        <h2>{{ product.name }}</h2>
        <p>Rp {{ product.price }}</p>
        <button @click="addToCart(product)">Tambah ke Keranjang</button>
      </div>
    </div>
    <div v-else>
      <p>Sedang memuat menu...</p>
    </div>

    <div class="cart-container">
      <h2>Keranjang Anda</h2>
      <div v-if="cart.length > 0">
        <ul>
          <li v-for="item in cart" :key="item.id">
            {{ item.name }} ({{ item.quantity }}x) - Rp {{ item.price * item.quantity }}
          </li>
        </ul>
        <hr>
        <h3>Total Harga: Rp {{ totalPrice }}</h3>
        <button @click="placeOrder" v-if="cart.length > 0">
          Pesan Sekarang
        </button>
      </div>
      <div v-else>
        <p>Keranjang masih kosong.</p>
      </div>
    </div>
  </div>
</template>

<style>
/* Style Anda tetap sama */
.menu-container {
  font-family: sans-serif;
  max-width: 800px;
  margin: 40px auto;
  padding: 20px;
}
.product-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.product-card {
  border: 1px solid #ccc;
  padding: 16px;
  border-radius: 8px;
}
h1, h2 {
  color: #333;
}
.cart-container {
  margin-top: 40px;
  border-top: 2px solid #eee;
  padding-top: 20px;
}
button {
  margin-top: 10px;
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button:hover {
  background-color: #0056b3;
}
</style>