describe('VO-UC01-008 Strict Validation: Sinkronisasi UI dan File Excel', () => {
  
  const downloadsFolder = Cypress.config('downloadsFolder');
  const searchInput = 'input[placeholder="Search..."]';

  beforeEach(() => {
    Cypress.on('uncaught:exception', () => false);

    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    cy.get('input[type="email"]').type('admin@admin.com', { force: true })
    cy.get('input[type="password"]').type('admin123!', { force: true }) 
    cy.get('button[type="submit"]').click({ force: true })
    cy.url().should('eq', 'http://pepi-semen.inaai.ai:5173/')

    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview') 
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000)

    // Bersihkan folder download biar nggak rancu dengan file lama
    cy.exec(`rm -rf ${downloadsFolder}/*`, { failOnNonZeroExit: false }) 
  })

  it('Validasi Ketat: Angka di layar UI harus PERSIS dengan angka di Excel', () => {
    
    cy.contains('button[role="tab"]', 'District', { matchCase: false }).click({ force: true })
    cy. wait(500)
    
    cy.log('--- 1. FILTER TOKO SPESIFIK ---')
    cy.get(searchInput, { timeout: 10000 })
    .should('be.visible')
    .clear({ force: true })
    .type('Sukolilo', { delay: 100, force: true })

    cy.log('--- 2. SCRAPING DATA DINAMIS DARI UI ---')
    
    // Cari baris K2 Jaya, lalu cari sel (td) terakhir yang merupakan kolom Total
    // Jika Total bukan di kolom terakhir, ganti .last() menjadi .eq(indeks_kolom) misalnya .eq(5)
    cy.contains('tr', 'Sukolilo')
      .find('td')
      .last() 
      .invoke('text')
      .then((teksSel) => {
        
        // Simpan angka tersebut ke dalam variabel dinamis (bersihkan dari spasi berlebih)
        const totalDinamisDariUI = teksSel.trim();
        cy.log(`🎯 Angka Total Sukolilo di layar saat ini adalah: ${totalDinamisDariUI}`);

        cy.log('--- 3. DOWNLOAD EXCEL ---')
        // Proses download HARUS berada di dalam blok .then() ini 
        // supaya variabel totalDinamisDariUI tidak hilang dari ingatan Cypress
        cy.contains('button', /export|download/i).click({ force: true })
        cy.wait(3000)

        cy.log('--- 4. BACA EXCEL DAN COCOKKAN SECARA DINAMIS! ---')
        cy.task('findFiles', { folder: downloadsFolder, mask: '.xlsx' }).then((files) => {
          expect(files.length).to.be.greaterThan(0, '🚨 File Excel gagal terunduh!');
          
          const filePath = `${downloadsFolder}/${files[0]}`;

          cy.task('parseXlsx', { filePath }).then((excelData) => {
            const sheet = excelData[0].data; 
            const excelTargetRow = sheet.find(row => row.includes('Sukolilo'));
            const excelRowString = excelTargetRow.join(' ');

            // ==========================================================
            // 🏆 VALIDASI DINAMIS (ANTI-HARDCODE)
            // ==========================================================
            
            // Cypress akan memasukkan angka berapapun yang dia temukan di UI ke dalam sini
            expect(excelRowString).to.include(
              totalDinamisDariUI, 
              `Angka dinamis ${totalDinamisDariUI} tampil di UI, tapi HILANG saat di-export ke Excel!`
            );

            // Validasi kebocoran data
            const flatExcelContent = JSON.stringify(sheet);
            expect(flatExcelContent).to.not.include('TOKO BINTANG JAYA', 'Data bocor!');
          });
        });
      });
  })
})