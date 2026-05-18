describe(' Heatmap District Mode', () => {
  const searchInput = 'input[placeholder="Search..."]';

  beforeEach(() => {
    Cypress.on('uncaught:exception', () => false);

    // Mencegat API hanya untuk dijadikan "Lampu Hijau" bahwa data sudah selesai dimuat
    cy.intercept('GET', '**/api/v1/visit-overview/visit-heatmap*').as('getHeatmapData');

    // Login dan Navigasi
    cy.visit('http://pepi-semen.inaai.ai:5173/login');
    cy.get('input[type="email"]').type('admin@admin.com', { force: true });
    cy.get('input[type="password"]').type('admin123!', { force: true });
    cy.get('button[type="submit"]').click({ force: true });
    cy.url().should('eq', 'http://pepi-semen.inaai.ai:5173/');
    
    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview');
    cy.get('.backdrop-blur-\\[1px\\]', { timeout: 15000 }).should('not.exist');
  });
  
  it('Memverifikasi jumlah kunjungan dan jumlah store per kecamatan pada heatmap', () => {
    
    // PERSIAPAN: Mock Data API khusus untuk District Mode
    // Pastikan endpoint API-nya sesuai dengan request saat District Mode aktif
    cy.intercept('GET', '**/api/v1/visit-overview/visit-heatmap*', {
      statusCode: 200,
      body: {
        data: [
          {
            id: 1,
            label: "Kenjeran", // Nama Kecamatan
            totalStores: 15,   // Langkah 8: Jumlah toko di kecamatan ini
            periods: {
              "2026": {
                "Jan": 10,
                "Feb": 25
              }
            },
            total: 35 // Langkah 7: Total keseluruhan (10 + 25)
          }
        ]
      }
    }).as('getDistrictData');

    // Langkah 1 & 2: Buka Visit Overview dan tunggu loading selesai
    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview');
    
    // Pastikan loading spinner/skeleton sudah hilang sebelum interaksi
    cy.get('.animate-spin', { timeout: 10000 }).should('not.exist'); 

    // Langkah 3: Klik toggle View dan pilih mode District
    cy.contains('button[role="tab"]', 'District', { matchCase: false })
      .click({ force: true });
      
    // Tunggu API District terpanggil
    cy.wait('@getDistrictData');

    // Langkah 4 & 5: Cari kecamatan "Kenjeran"
    cy.get('input[placeholder="Search..."]')
      .clear({ force: true })
      .type('Kenjeran{enter}', { force: true });
    
    // Validasi Baris Kenjeran
    cy.contains('tr', 'Kenjeran', { matchCase: false }).should('be.visible').within(() => {
      
      // Langkah 8: Cocokkan angka jumlah stores (15) di sebelah nama kecamatan
      // NOTE: Sesuaikan selector ini. Biasanya angka ini ada di dalam badge (span) di dekat nama.
      // Contoh jika HTML-nya: <span>Kenjeran</span> <span class="badge">15 Stores</span>
      cy.get('td').eq(0).should('contain.text', '15'); 

      cy.get('td').should(($cells) => {
        // Langkah 6: Cocokkan jumlah kunjungan per bulan (Jan & Feb)
        // PERHATIAN: Sesuaikan indeks eq() ini dengan posisi kolom bulan di tabelmu
        // Asumsi: eq(0) = Nama & Jumlah Store, eq(1) = Januari, eq(2) = Februari
        
        const textJan = $cells.eq(1).text().trim();
        expect(textJan).to.eq('10', 'Data kunjungan bulan Januari harus sesuai dengan API');
        
        const textFeb = $cells.eq(2).text().trim();
        expect(textFeb).to.eq('25', 'Data kunjungan bulan Februari harus sesuai dengan API');

        // Langkah 7: Cocokkan kolom Total
        // Jika kolom Total ada di akhir, kita bisa cari indeks terakhir
        const textTotal = $cells.last().text().trim();
        expect(textTotal).to.eq('35', 'Kolom Total kunjungan harus kalkulasi dengan benar');
      });
    });
    
  });
});