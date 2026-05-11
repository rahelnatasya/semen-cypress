describe('Territory Analytics - Filter Kecamatan (API Dynamic)', () => {
  
  beforeEach(() => {
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('WebSocket')) return false; 
      if (err.message.includes("reading 'lat'")) return false;
      if (err.message.includes("reading '1'")) return false;
      return true; 
    });

    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    cy.get('input[type="email"]').type('admin@admin.com', { force: true })
    cy.get('input[type="password"]').type('admin123!', { force: true }) 
    cy.get('button[type="submit"]').click({ force: true })
    cy.url().should('eq', 'http://pepi-semen.inaai.ai:5173/')
  })

  it('Verifikasi UI detail Kecamatan berdasarkan data API (Happy Path)', () => {
    
    // --- GANTI NAMA KECAMATAN YANG MAU DITES DI SINI ---
    const targetKecamatan = 'Kenjeran'; 
    
    // 1. Mencegat API saat halaman pertama kali dimuat
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getAnalytics')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    
    // 2. TANGKAP DATA API DAN CARI DATA KECAMATAN
    cy.wait('@getAnalytics').then((interception) => {
      const apiBody = interception.response.body;
      
      // Cypress mencari array district yang bernama sesuai target (Sukolilo)
      const dataKecamatan = apiBody.districts.find(district => district.name === targetKecamatan);
      
      // Cypress mengingat JUMLAH TOKO dari atribut storeCount API (Dalam JSON saat ini: 7)
      const expectedStoreCount = dataKecamatan.storeCount;

      cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
      cy.wait(1000)

      // 3. BUKA PANEL KIRI
      cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
      cy.wait(500) 

      // 4. BUKA DROPDOWN KECAMATAN
      cy.contains('label','Kecamatan', { matchCase: false })
      .parent()
        .find('input[type="text"]')
        .click({ force: true }) // Klik untuk memastikan dropdown aktif/terbuka
        .clear({ force: true })
        .type(targetKecamatan, { force: true })
      cy.wait(500) 

      cy.get('body')
        .contains(targetKecamatan)
        .not('input') // Jangan klik kotak inputnya lagi
        .last() // Biasanya opsi dropdown dirender di urutan DOM paling bawah
        .click({ force: true })

      cy.wait(2000) // Tunggu animasi peta dan re-render panel detail

      // 6. VALIDASI UI BERDASARKAN DATA API (Tepat Sasaran!)
      cy.get('.p-4.border-b.border-slate-100').within(() => {
        // Cek Nama Kecamatan di Header H3
        cy.get('h3').should('have.text', targetKecamatan)
        
        // Cek Angka "Stores" 
        // Mencari kotak elemen yang mengandung kata "Stores"
        cy.contains('.rounded-lg', 'Stores', { matchCase: false })
          // Menembak tepat di class angka besarnya
          .find('.text-lg.font-bold') 
          // Memastikan angka yang tertulis sama dengan storeCount dari API
          .should('have.text', expectedStoreCount.toString()) 
      })

      // 7. Validasi tambahan (Breadcrumb)
      cy.get('.px-4.pt-1.pb-2')
        .should('contain', 'Explore')
        .and('contain', targetKecamatan)
      
      // 8. Verifikasi tombol navigasi kembali muncul
      cy.contains('button', 'Back to All Kecamatan').should('be.visible')

      cy.log(`✅ Sempurna! Data ${targetKecamatan} dari API memiliki ${expectedStoreCount} toko, dan UI berhasil menampilkannya.`);
    })
  })
})