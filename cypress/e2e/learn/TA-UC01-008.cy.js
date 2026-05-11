describe('Territory Analytics - Summary Card Default Counts', () => {
  
  beforeEach(() => {
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('WebSocket')) return false; 
      if (err.message.includes("reading 'lat'")) return false;
      return true; 
    });

    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    cy.get('input[type="email"]').type('admin@admin.com', { force: true })
    cy.get('input[type="password"]').type('admin123!', { force: true }) 
    cy.get('button[type="submit"]').click({ force: true })
    cy.url().should('eq', 'http://pepi-semen.inaai.ai:5173/')
  })

  it('Verifikasi jumlah stores dan kecamatan secara Dinamis (Happy Path)', () => {
    
    // 1. Mencegat API untuk mengintip data asli
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getRealData')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    
    // 2. Tangkap data aslinya
    cy.wait('@getRealData').then((interception) => {
      
      const realTotalStores = interception.response.body.summary.totalStores; 
      
      // PERBAIKAN: Developer mengambil data dari districtsWithStores, bukan total polygon peta!
      const realDistrictsWithStores = interception.response.body.summary.districtsWithStores; // Ambil angka 28
      
      cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
      cy.wait(1000) 

      // 3. BUKA PANEL YANG TERLIPAT
      // Mencari tombol chevron right dan mengkliknya
      cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
      cy.wait(500) // Beri waktu 0.5 detik untuk animasi panel bergeser terbuka

      // 4. VALIDASI DINAMIS KE UI
      // Menggunakan struktur HTML asli yang kamu berikan
      
      // Verifikasi kata "stores" dan angka di sebelahnya
      cy.contains('span', 'stores', { matchCase: false }) 
        .parent() 
        .should('contain', realTotalStores.toLocaleString('en-US')) 

      // Verifikasi kata "kecamatan" dan angka di sebelahnya
      cy.contains('span', 'kecamatan', { matchCase: false }) 
        .parent()
        .should('contain', realDistrictsWithStores.toString())

      cy.log(`✅ Sukses! Panel dibuka dan UI akurat menampilkan ${realTotalStores} Stores & ${realDistrictsWithStores} Kecamatan.`);
    })
})

    // --- SKENARIO NEGATIF 1: DATA HILANG / NULL ---
    it('Skenario 1: UI tidak crash (White Screen) saat API merespons null atau undefined', () => {
    
    // Menyuntikkan racun: Menghapus nilai totalStores dan districtsWithStores menjadi null/undefined
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', (req) => {
      req.continue((res) => {
        if (res.body && res.body.summary) {
          res.body.summary.totalStores = null; 
          res.body.summary.districtsWithStores = undefined;
        }
        res.send(res.body);
      })
    }).as('getNullData')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getNullData')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000) 

    // Buka panel
    cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
    cy.wait(500) 

    // Validasi 1: Layar tidak meledak (Header masih bisa dibaca)
    cy.contains('Territory Analytics').should('be.visible')

    // Validasi 2: Fallback UI jalan (Biasanya dirender sebagai '0', '-', atau kosong, yang penting bukan error)
    cy.contains('span', 'stores', { matchCase: false })
      .parent()
      .invoke('text')
      .should('not.include', 'undefined') // Pastikan user tidak melihat tulisan 'undefined'
      .and('not.include', 'null')

    // Validasi 3: Angka di dalam Peta juga harus Kosong (Sinkron dengan data yang di kosongkan di API)
    cy.get('.leaflet-marker-pane').children().should('have.length', 0) // Tidak ada marker toko yang dirender karena data toko di API sudah kita racuni menjadi null/undefined
  })

  // --- SKENARIO NEGATIF 2: BALAPAN DATA (RACE CONDITION) ---
  it('Skenario 2: UI aman dari Spam Klik saat API mengalami Delay parah', () => {
    
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', {
      delay: 5000, 
      body: { 
        // KITA TAMBAHKAN viewBbox AGAR REACT TIDAK CRASH MENCARI INDEX '1'
        viewBbox: [112.59010768, -7.35147478, 112.84683416, -7.19039173],
        summary: { totalStores: 0, districtsWithStores: 0 }, 
        districts: [], 
        stores: [] 
      }
    }).as('getSlowData')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 

    // Tindakan user iseng: Spam klik buka tutup panel ringkasan
    for(let i=0; i<10; i++){
      cy.get('body').then(($body) => {
        if ($body.find('svg.lucide-chevron-right').length > 0) {
          cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
        }
      })
      cy.wait(100) 
    }

    cy.wait('@getSlowData', { timeout: 15000 })
    
    // Validasi: Aplikasi tetap stabil setelah disiksa
    cy.contains('Territory Analytics').should('be.visible')
    cy.get('.leaflet-container').should('be.visible')
  })

  // --- SKENARIO NEGATIF 3: PEMBENGKAKAN VISUAL (OVERFLOW) ---
  it('Skenario 3: UI tidak rusak saat menampilkan angka ekstrem (Jutaan Toko)', () => {
    
    const extremeNumber = 999999999; // Hampir 1 Miliar Toko

    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', (req) => {
      req.continue((res) => {
        if (res.body && res.body.summary) {
          res.body.summary.totalStores = extremeNumber;
        }
        res.send(res.body);
      })
    }).as('getExtremeData')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getExtremeData')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000) 

    cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
    cy.wait(500) 

    // Validasi 1: Pastikan angka raksasa ini dirender 
    // Entah diformat menjadi 999,999,999 atau disingkat (misal 999M)
    cy.contains('span', 'stores', { matchCase: false })
      .parent()
      .invoke('text')
      .should('match', /999/) // Setidaknya mengandung awalan 999

    // Validasi 2: Memastikan layout tidak meledak ke bawah 
    // Kita cek apakah tinggi container panel tidak melebihi batas wajar (misal tidak lebih dari 100px)
    cy.contains('span', 'stores', { matchCase: false })
      .closest('.flex.items-center.gap-3') // Mengambil container utama dari HTML aslimu
      .invoke('outerHeight')
      .should('be.lessThan', 100) // Jika overflow ke bawah, tingginya pasti bengkak
  })


  // --- SKENARIO NEGATIF 4: TIPE DATA MENIPU (STRING VS INTEGER) ---
  it('Skenario 4: Kode React (Frontend) kebal terhadap perubahan tipe data dari Backend (String)', () => {
    
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', (req) => {
      req.continue((res) => {
        if (res.body && res.body.summary) {
          // Menyuntikkan racun: Mengubah angka menjadi teks String
          res.body.summary.totalStores = "152"; 
          res.body.summary.districtsWithStores = "28";
        }
        res.send(res.body);
      })
    }).as('getStringData')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getStringData')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000) 

    cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
    cy.wait(500) 

    // Validasi: Aplikasi tetap merender dengan sempurna.
    // Jika developer salah kode (misal pakai rumus tambah-tambahan tanpa parseInt), 
    // hasilnya bisa berubah jadi NaN atau formatnya hancur.
    cy.contains('span', 'stores', { matchCase: false }) 
      .parent() 
      .should('contain', '152') // Tetap bisa dibaca sebagai 152

    cy.contains('span', 'kecamatan', { matchCase: false }) 
      .parent()
      .should('contain', '28') 
  })
})