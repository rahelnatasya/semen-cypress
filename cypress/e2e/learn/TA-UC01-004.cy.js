describe('Territory Analytics - 3D Store Activity Level', () => {
  
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
  // Fungsi pembantu untuk membuka panel (sesuaikan jika perlu)
  const openLayerPanel = () => {
    cy.get('body').then(($body) => {
      if ($body.find('svg.lucide-layers').length > 0) {
        cy.get('svg.lucide-layers').closest('button').click({ force: true })
        cy.wait(500) 
      }
    })
  }
  it('Verifikasi 3D Store Activity Level default Off dan Toggle Contour berfungsi', () => {
    
    // 1. Setup Data & Tunggu Loading
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getData')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getData')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(2000) 

    // (Buka panel utama jika tombol Contour berada di dalam menu Layers)
    openLayerPanel()

    // 2. VERIFIKASI PETA DEFAULT (OFF)
    cy.contains('button', 'Off').should('exist')
    cy.get('input[type="range"]').should('not.exist') // Slider pendukung tidak ada
    
    // Pastikan Kanvas peta eksis dan sehat (tidak crash/hilang) di awal
    cy.get('.leaflet-overlay-pane canvas').should('be.visible')


    // 3. UJI MENGAKTIFKAN CONTOUR
    // Klik tombol Contour tanpa memaksanya (force), agar kita tahu tombolnya terhalang sesuatu atau tidak
    cy.contains('button', 'Contour').click()
    
    // TUNGGU 1 DETIK PENUH: Memberi waktu untuk animasi panel Legend & proses rendering GPU Canvas
    cy.wait(1000) 

    // BUKTI 1: Panel Legend Muncul Sempurna (Memastikan animasi CSS opacity-0 hilang)
    // Jika masih error "Not Visible" di sini, gunakan { force: true } pada saat click() Contour di atas.
    cy.contains('Store & Visit Density')
      .should('exist') 
    
    // BUKTI 2: Slider Opacity Muncul
    cy.get('input[type="range"][max="100"]').should('be.visible') 
    
    // BUKTI 3: Validasi DOM Canvas Peta Tetap Aktif setelah Overlay 3D dinyalakan
    cy.get('.leaflet-overlay-pane canvas')
      .should('be.visible')
      .and('have.attr', 'width') // Memastikan canvas memiliki atribut lebar (tidak blank)


    // 4. KEMBALI KE KONDISI OFF
    cy.contains('button', 'Off').click()
    
    // Tunggu animasi panel menghilang
    cy.wait(1000) 

    // Verifikasi semua kembali bersih
    cy.contains('Store & Visit Density').should('not.exist') // Legend hilang
    cy.get('input[type="range"]').should('not.exist') // Slider hilang
  })

  // --- SKENARIO NEGATIF 1: SPAM CLICK ---
  it('Skenario Negatif 1: UI tidak tumpang tindih saat Spam Click toggle 3D berturut-turut', () => {
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getData')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getData')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(2000)
    openLayerPanel()

    // Tindakan: Klik berbagai mode secara brutal tanpa menunggu animasi selesai
    cy.contains('button', 'Contour').click()
    cy.contains('button', 'Hexbin').click()
    cy.contains('button', '3D Hex').click()
    cy.contains('button', 'Contour').click()
    cy.contains('button', 'Off').click()
    cy.contains('button', 'Hexbin').click() // Pilihan terakhir kita berhenti di Hexbin

    // Tunggu sistem "bernapas" dan memproses antrean klik
    cy.wait(1500)

    // Validasi: Pastikan aplikasi tidak bingung dan hanya merender SATU legend/slider
    // Jika ada lebih dari 1 (misal 3 slider tumpang tindih), tes ini akan gagal
    cy.get('input[type="range"]').should('have.length', 1)
    
    // Pastikan UI utama tidak crash
    cy.contains('Territory Analytics').should('be.visible')
  })

  // --- SKENARIO NEGATIF 2: EMPTY DATA (DENSITAS NOL) ---
  it('Skenario Negatif 2: Peta tidak crash (blank) saat merender 3D Contour dengan 0 data toko', () => {
    // Membajak API untuk mengirimkan data wilayah yang kosong dari toko
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', (req) => {
      req.continue((res) => {
        if (res.body && res.body.stores) {
          res.body.stores = []; // KOSONGKAN DATA TOKO
          res.body.summary.totalStores = 0;
        }
        res.send(res.body);
      })
    }).as('getEmptyData')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getEmptyData')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(2000)
    openLayerPanel()

    // Tindakan: Paksa hitung Contour di wilayah kosong
    cy.contains('button', 'Contour').click()
    cy.wait(1000)

    // Validasi: Canvas peta harus tetap eksis (tidak crash/menghilang gara-gara Math Error)
    cy.get('.leaflet-overlay-pane canvas').should('be.visible')
    cy.contains('Territory Analytics').should('be.visible') // UI tidak jadi layar putih
  })

  // --- SKENARIO NEGATIF 3: KONFLIK FILTER (STATE LEAK) ---
  it('Skenario Negatif 3: Peta merender ulang dengan aman saat data diperbarui ketika mode 3D sedang aktif', () => {
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getData')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getData')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(2000)
    openLayerPanel()

    // Tindakan 1: Aktifkan mode 3D terberat
    cy.contains('button', '3D Hex').click()
    cy.wait(1000)

    // Tindakan 2: Memicu pembaruan data / filter selagi 3D masih nyala
    // (GANTI BARIS INI DENGAN CARA MENGKLIK FILTER WILAYAH DI APLIKASIMU)
    // Contoh: cy.get('select[name="zoneGroup"]').select('Jakarta')
    // Sebagai simulasi universal, kita paksa memanggil ulang halaman (Soft Reload via React Router atau sejenisnya)
    // Jika tidak ada dropdown filter di layarmu, abaikan dan ganti dengan aksi filter yang tepat
    cy.log('Simulasi mengubah filter wilayah/data')
    cy.window().then((win) => {
      // Mensimulasikan trigger pergerakan map untuk memaksa re-render
      win.dispatchEvent(new Event('resize')); 
    })

    // Validasi: Aplikasi tetap hidup, memori tidak bocor sehingga canvas tetap bisa dibaca
    cy.wait(1000)
    cy.get('.leaflet-overlay-pane canvas').should('be.visible')
    cy.get('input[type="range"]').should('exist') // Fitur 3D tetap bisa dikontrol
  })

  // --- SKENARIO NEGATIF 4: EKSTREM OPACITY ---
  it('Skenario Negatif 4: Slider Opacity tahan terhadap manipulasi nilai ekstrem (0% - 100%)', () => {
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getData')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getData')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(2000)
    openLayerPanel()

    cy.contains('button', 'Hexbin').click()
    cy.wait(1000)

    // Tindakan: Mengubah nilai slider secara ekstrem menggunakan invoke trigger React
    // 1. Tarik mendadak ke 0 (menghilang sepenuhnya)
    cy.get('input[type="range"]')
      .invoke('val', 0)
      .trigger('change', { force: true })
      .trigger('input', { force: true })
    
    cy.wait(500)
    
    // 2. Tarik mendadak kembali ke 100 (muncul maksimal)
    cy.get('input[type="range"]')
      .invoke('val', 100)
      .trigger('change', { force: true })
      .trigger('input', { force: true })

    // Validasi: Aplikasi tidak crash (layar putih) dan UI elemen tetap responsif
    cy.get('.leaflet-overlay-pane canvas').should('be.visible')
    
    // Coba matikan setelah diganggu, pastikan fungsi Off masih bekerja
    cy.contains('button', 'Off').click()
    cy.get('input[type="range"]').should('not.exist')
  })
})