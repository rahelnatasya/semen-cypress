describe('Territory Analytics - Geo Map District Rank Color', () => {
  
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

  it('Verifikasi lingkaran angka Rank (A, B, C) pada Peta sesuai Legend (Happy Path)', () => {
    
    // 1. Tunggu data API dan Peta ter-render
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getData')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getData')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(3000) 

    // 2. VALIDASI LEGEND (Area Density)
    cy.contains('Rank A').should('be.visible')
    cy.contains('Rank B').should('be.visible')
    cy.contains('Rank C').should('be.visible')

    // 3. VALIDASI MARKER LINGKARAN (ANGKA) DI ATAS PETA UNTUK DATA DINAMIS
    cy.get('.leaflet-marker-pane').then(($pane) => {
      
      // Kita buat fungsi kecil untuk mencari lingkaran angka berdasarkan warna
      const findRankMarkers = (colorHex) => {
        // Cari semua div dengan warna tersebut, lalu filter HANYA yang isinya murni angka
        return $pane.find(`div[style*="${colorHex}"]`).filter((index, el) => {
          return /^\d+$/.test(el.innerText.trim());
        });
      };

      // a. Cek Rank A (Hijau)
      const greenMarkers = findRankMarkers('#16a34a');
      if (greenMarkers.length > 0) {
        cy.log(`Ditemukan ${greenMarkers.length} lingkaran Rank A (Hijau)`);
      }

      // b. Cek Rank B (Orange)
      const orangeMarkers = findRankMarkers('#ea580c');
      if (orangeMarkers.length > 0) {
        cy.log(`Ditemukan ${orangeMarkers.length} lingkaran Rank B (Orange)`);
      }

      // c. Cek Rank C (Merah)
      const redMarkers = findRankMarkers('#dc2626');
      if (redMarkers.length > 0) {
        cy.log(`Ditemukan ${redMarkers.length} lingkaran Rank C (Merah)`);
      } else {
        // Tes tidak akan gagal, Cypress hanya memberikan info bahwa datanya sedang kosong
        cy.log('Info: Saat ini tidak ada data wilayah untuk Rank C (Merah)'); 
      }

      // ASERSI UTAMA: 
      // Karena kita menguji aplikasi nyata, kita harus memastikan minimal 
      // ADA SATU SAJA marker Rank (apa pun warnanya) yang berhasil digambar oleh React di atas peta.
      const totalMarkers = greenMarkers.length + orangeMarkers.length + redMarkers.length;
      expect(totalMarkers).to.be.greaterThan(0, 'Peta harus merender setidaknya 1 marker Rank');
    })

    // 4. VALIDASI INTERAKTIF (Opsional)
    // Memastikan jika lingkaran angka diklik, ia merespons (misal: muncul tooltip/detail)
    cy.get('div[style*="border-radius:50%"]').first().click({ force: true })
    cy.wait(500)
  })
  // --- SKENARIO 1: BRUTAL ZOOMING & PANNING ---
  it('Skenario Negatif 1: Peta dan Marker tidak crash saat di-drag dan di-zoom secara brutal', () => {
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getData')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getData')
    cy.wait(2000)

    // Tindakan: Simulasi User Drag (Pan) peta secara kasar
    cy.get('.leaflet-container')
      .trigger('mousedown', { which: 1, clientX: 500, clientY: 500 })
      .trigger('mousemove', { clientX: 100, clientY: 100 }) // Tarik paksa ke kiri atas
      .trigger('mouseup', { force: true })
      
    // Tindakan: Simulasi User Scroll roda mouse (Zoom Out / In) berkali-kali
    cy.get('.leaflet-container')
      .trigger('wheel', { deltaY: -500 }) // Zoom in
      .trigger('wheel', { deltaY: 1000 }) // Zoom out 
      
    cy.wait(1000) // Biarkan GPU dan Leaflet mencerna animasi

    // Validasi: Aplikasi tetap hidup (tidak ada White Screen of Death)
    cy.contains('Territory Analytics').should('be.visible')
    // Validasi: Marker peta masih bisa dirender oleh React
    cy.get('.leaflet-marker-pane').children().should('have.length.greaterThan', 0)
  })

  // --- SKENARIO 2: DATA SILUMAN (RANK Z & NULL) ---
  it('Skenario Negatif 2: Aplikasi fallback ke abu-abu dan tidak crash saat menerima Rank aneh', () => {
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', (req) => {
      req.continue((res) => {
        if (res.body && res.body.districts && res.body.districts.length >= 2) {
          // Menyuntikkan "Racun" Data (Rank yang tidak pernah dibuat developernya)
          res.body.districts[0].rank = 'Z'; // Rank yang tidak valid
          res.body.districts[1].rank = null; // Data Kosong dari Backend
        }
        res.send(res.body);
      })
    }).as('getCorruptData')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getCorruptData')
    cy.wait(2000)

    // Validasi 1: Aplikasi tidak langsung meledak (White Screen)
    cy.contains('Territory Analytics').should('be.visible')

    // Validasi 2: Fallback system berjalan (Data rusak harus di-render sebagai Abu-abu/Others: #64748b)
    cy.get('.leaflet-marker-pane').within(() => {
      cy.get('div[style*="#64748b"]')
        .should('exist')
        .and('have.length.at.least', 2) // Minimal ada 2 data siluman yang kita buat tadi
    })
  })


  // --- SKENARIO 3: FILTER HAMPA (ZERO DATA) ---
  it('Skenario Negatif 3: Peta tidak meledak (Division by Zero) saat data wilayah kosong melompong', () => {
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', (req) => {
      req.continue((res) => {
        // Simulasi hasil filter yang mengembalikan array kosong
        if (res.body){
        res.body.districts = []; 
        if (res.body.stores) res.body.stores = [];
        if (res.body.summary) res.body.summary.totalStores = 0;
      }
        res.send(res.body);
      })
    }).as('getEmptyData')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getEmptyData')
    cy.wait(2000)

    // Validasi: Aplikasi tetap hidup (Math/Division error tertangani dengan baik oleh dev)
    cy.contains('Territory Analytics').should('be.visible')
    
    // Validasi: Tidak ada marker apapun di atas peta, tapi peta tetap ada
    cy.get('.leaflet-container').should('be.visible')
    cy.get('.leaflet-marker-pane').children().should('have.length', 0)
  })


  // --- SKENARIO 4: SPAM KLIK (Z-INDEX & DEBOUNCE) ---
  it('Skenario Negatif 4: Mencegah Tumpang Tindih Popup/Tooltip saat marker di-spam klik', () => {
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getData')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getData')
    cy.wait(2000)

    // Tindakan: Ambil SATU marker saja, lalu klik 10 kali dalam waktu 0.5 detik (brutal)
    cy.get('.leaflet-marker-pane div[style*="border-radius:50%"]').first().as('targetMarker')
    
    for(let i=0; i<10; i++){
      cy.get('@targetMarker').click({ force: true })
    }

    cy.wait(1000)

    // Validasi: Kita cek kelemahan UI. 
    // Asumsi: Saat diklik, marker memunculkan sebuah tooltip/popup (biasanya punya class .leaflet-popup atau modal)
    // Jika developer pintar, hanya akan ada MAKSIMAL 1 popup yang muncul, bukan 10 tertumpuk.
    
    cy.get('body').then(($body) => {
      // Jika aplikasimu pakai popup bawaan leaflet:
      if ($body.find('.leaflet-popup').length > 0) {
        cy.get('.leaflet-popup').should('have.length.at.most', 1)
      } 
      // Atau jika tidak ada popup sama sekali saat diklik, minimal UI tidak meledak
      cy.contains('Territory Analytics').should('be.visible')
    })
  })
})