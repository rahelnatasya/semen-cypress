describe('Territory Analytics - Area Data Visualization', () => {
  
  beforeEach(() => {
    // Abaikan error bawaan Vite
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('WebSocket')) return false; 
      return true; 
    });

    // Login
    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    cy.get('input[type="email"]').type('admin@admin.com', { force: true })
    cy.get('input[type="password"]').type('admin123!', { force: true }) 
    cy.get('button[type="submit"]').click({ force: true })
    cy.url().should('eq', 'http://pepi-semen.inaai.ai:5173/')
  })

  const openLayerPanel = () => {
    cy.get('body').then(($body) => {
      if ($body.find('svg.lucide-layers').length > 0) {
        cy.get('svg.lucide-layers').closest('button').click({ force: true })
        cy.wait(500) 
      }
    })
  }

  // Skenario Utama mengikuti persis langkah 1 s/d 8 di Test Case
  it('Memverifikasi seluruh filter Area Data Visualization aktif dan bisa di-toggle berurutan', () => {
    
    // Langkah 1 & 2: Buka Territory Analytics & Tunggu Loading
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getData')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getData')
    
    // Pastikan layar loading (backdrop blur) sudah benar-benar hilang
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(2000) // Ekstra jeda agar peta Leaflet/Canvas selesai merender

    // VALIDASI EKSPEKTASI 1: Pada tampilan default, seluruh 4 toggle aktif
    const toggles = ['Territory Zones', 'Store Locations', 'Kecamatan Labels', 'Zone Fill Color']
    toggles.forEach((name) => {
      // Pastikan ada SVG centang (viewBox 0 0 8 8) di setiap tombol
      cy.contains('button', name).find('svg[viewBox="0 0 8 8"]').should('exist') 
    })

    // Langkah 4: Nonaktifkan toggle Territory Zones dan perhatikan perubahan
    cy.contains('button', 'Territory Zones').click({ force: true })
    // Validasi menu benar-benar merespons (centang hilang)
    cy.contains('button', 'Territory Zones').find('svg[viewBox="0 0 8 8"]').should('not.exist')

    // Langkah 5: Aktifkan kembali Territory Zones, lalu nonaktifkan Store Locations
    cy.contains('button', 'Territory Zones').click({ force: true })
    cy.contains('button', 'Store Locations').click({ force: true })
    // Validasi menu merespons
    cy.contains('button', 'Store Locations').find('svg[viewBox="0 0 8 8"]').should('not.exist')

    // Langkah 6: Aktifkan kembali Store Locations, lalu nonaktifkan Kecamatan Labels
    cy.contains('button', 'Store Locations').click({ force: true })
    cy.contains('button', 'Kecamatan Labels').click({ force: true })
    // Validasi menu merespons
    cy.contains('button', 'Kecamatan Labels').find('svg[viewBox="0 0 8 8"]').should('not.exist')

    // Langkah 7: Aktifkan kembali Kecamatan Labels, lalu nonaktifkan Zone Fill Color
    cy.contains('button', 'Kecamatan Labels').click({ force: true })
    cy.contains('button', 'Zone Fill Color').click({ force: true })
    // Validasi menu merespons
    cy.contains('button', 'Zone Fill Color').find('svg[viewBox="0 0 8 8"]').should('not.exist')

    // Langkah 8: Aktifkan kembali semua toggle ke kondisi default
    cy.contains('button', 'Zone Fill Color').click({ force: true })

    // VALIDASI EKSPEKTASI 6: Saat semua diaktifkan, kondisi kembali seperti semula
    toggles.forEach((name) => {
      cy.contains('button', name).find('svg[viewBox="0 0 8 8"]').should('exist') 
    })
  })

  // Blok ini khusus mengeksekusi catatan "Special Case Bug" yang kamu buat
  it('Special Case Bug: Menguji anomali fungsionalitas Kecamatan Labels', () => {
    
    // Setup halaman
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getData')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getData')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(2000)

    cy.get('body').then(($body) => {
      if ($body.find('svg.lucide-layers').length > 0) {
        cy.get('svg.lucide-layers').closest('button').click({ force: true })
        cy.wait(500) 
      }
    })

    // SPECIAL CASE: Membuktikan bahwa menghilangkan centang Store Locations akan membuat Kecamatan Labels berfungsi
    
    // 1. Matikan Store Locations (Syarat trigger bug)
    cy.contains('button', 'Store Locations').click({ force: true })
    
    // 2. Matikan Kecamatan Labels
    cy.contains('button', 'Kecamatan Labels').click({ force: true })
    
    // 3. Verifikasi UI Centang hilang
    cy.contains('button', 'Kecamatan Labels').find('svg[viewBox="0 0 8 8"]').should('not.exist')
    
    // (Jika ingin menambah validasi class DOM Peta, bisa diletakkan di bawah sini)
  })
  // --- SKENARIO A: Data Anomali (Toko tanpa Koordinat Lat/Long) ---
  it('Skenario A: UI tidak crash saat menerima data Store dengan koordinat null', () => {
    
    // PERBAIKAN: Struktur data disamakan persis dengan interface DemographicResponse di React
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', (req) => {
      req.continue((res) => {
        // Karena kita sudah tahu struktur aslinya, kita langsung tembak 'res.body.stores'
        if (res.body && res.body.stores && res.body.stores.length > 0) {
          // Sengaja merusak koordinat 1 toko pertama menjadi null
          res.body.stores[0].latitude = null;
          res.body.stores[0].longitude = null;
        }
        
        // Kirimkan kembali data yang sudah diubah ke React
        res.send(res.body);
      })
    }).as('getCorruptData')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getCorruptData')
    
    // Tunggu loading selesai
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(2000)
    openLayerPanel()

    // Tindakan: Mengklik toggle Store Locations
    cy.contains('button', 'Store Locations').click({ force: true })
    
    // Validasi: Aplikasi berhasil menonaktifkan toggle TANPA crash
    cy.contains('button', 'Store Locations').find('svg[viewBox="0 0 8 8"]').should('not.exist')
    cy.contains('Territory Analytics').should('be.visible')
  })

  // --- SKENARIO B: Empty State (Kecamatan tanpa Toko) ---
  it('Skenario B: Toggle tetap berfungsi normal meskipun tidak ada data toko sama sekali', () => {
    
    // Kita menipu aplikasi dengan mengirimkan array stores KOSONG ([])
cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', {
      statusCode: 200,
      body: {
        viewBbox: [112.590107, -7.351474, 112.846834, -7.190391],
        districts: [
          { id: "asemrowo", name: "Asemrowo", geometry: null, storeCount: 0 }
        ],
        stores: [], // <--- INI BINTANG UTAMANYA: Data Toko Kosong!
        summary: { 
          totalStores: 0, 
          districtsWithStores: 0, 
          rankA: 0, 
          rankB: 0, 
          rankC: 0, 
          rankOthers: 0 
        }
      }
    }).as('getEmptyStores')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getEmptyStores')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(2000)
    openLayerPanel()

    // Tindakan: Mengklik toggle Store Locations
    cy.contains('button', 'Store Locations').click({ force: true })
    
    // Validasi: Aplikasi tidak error karena berusaha membaca length dari array kosong
    cy.contains('button', 'Store Locations').find('svg[viewBox="0 0 8 8"]').should('not.exist')
  })

  // --- SKENARIO C: Spam Click (Stress Test) ---
  it('Skenario C: UI tahan banting terhadap spam click berturut-turut', () => {
    
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getData')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getData')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(2000)
    openLayerPanel()

    // Tindakan: Spam klik sebanyak 5 kali secara cepat (tanpa jeda tunggu rendering)
    for (let i = 0; i < 5; i++) {
      cy.contains('button', 'Store Locations').click({ force: true })
    }
    
    // Validasi: Karena diklik 5 kali (ganjil) dari posisi NYALA, maka hasil akhirnya harus MATI.
    // Yang terpenting di sini adalah memastikan browser tidak freeze/macet karena re-render beruntun.
    cy.contains('button', 'Store Locations').find('svg[viewBox="0 0 8 8"]').should('not.exist')
    cy.contains('Territory Analytics').should('be.visible')
  })

  // --- SKENARIO D: Jaringan Lambat (Network Latency) ---
  it('Skenario D: UI merespons anggun saat jaringan lambat (API memakan waktu lama)', () => {
    
    // Mencegat API dan sengaja menahannya selama 5 detik
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', (req) => {
      req.on('response', (res) => {
        res.setDelay(5000) // Tahan data selama 5 detik
      })
    }).as('getSlowData')

    // Mulai kunjungi halaman
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    
    // Alih-alih menebak class CSS loading yang mungkin berubah-ubah, 
    // kita asersikan bahwa selama 5 detik ini, PETA BELUM ADA atau DATA BELUM MUNCUL,
    // membuktikan bahwa UI memang sedang tertahan (loading state).
    cy.contains('button', 'Store Locations').should('not.exist') // Panel belum dirender karena masih loading
    
    // Kita beritahu Cypress untuk bersabar menunggu API yang lambat ini (maksimal 10 detik)
    cy.wait('@getSlowData', { timeout: 10000 })
    
    // Setelah data yang tertunda 5 detik itu akhirnya masuk,
    // pastikan layar tidak nyangkut dan efek loading hilang
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist')
    
    // BERIKAN BUKTI: Verifikasi aplikasi TIDAK CRASH dan fitur tetap berjalan normal
    cy.wait(2000) // Waktu agar React selesai merender Peta
    openLayerPanel()
    cy.contains('button', 'Store Locations').click({ force: true })
    cy.contains('button', 'Store Locations').find('svg[viewBox="0 0 8 8"]').should('not.exist')
    
    // Pastikan judul halaman tetap berdiri kokoh (UI tidak blank)
    cy.contains('Territory Analytics').should('be.visible')
  })
})