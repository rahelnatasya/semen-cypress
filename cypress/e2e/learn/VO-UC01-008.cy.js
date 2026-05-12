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
    cy.task('clearFolder', { folderPath: downloadsFolder });
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
  it('CASE 1: Validasi Export Hanya untuk Data yang Di-filter (K2 Jaya)', () => {
    cy.get(searchInput).clear({ force: true }).type('K2 Jaya', { force: true });
    cy.wait(1000);

    cy.contains('button', /export|download/i).click({ force: true });
    cy.wait(3000);

    cy.task('findFiles', { folder: downloadsFolder, mask: '.xlsx' }).then((files) => {
      const filePath = `${downloadsFolder}/${files[0]}`;
      cy.task('parseXlsx', { filePath }).then((excelData) => {
        const rows = excelData[0].data;
        
        // Validasi: Harus ada Header + 1 baris data K2 Jaya saja
        expect(rows.length).to.be.at.most(2, '🚨 BUG: File Export berisi lebih dari 1 data, padahal sudah di-filter!');
        expect(JSON.stringify(rows)).to.include('K2 Jaya');
      });
    });
  });
  it('CASE 2 & 3: Validasi Export Mode District dan Penamaan File Deskriptif', () => {
    cy.contains('button[role="tab"]', 'District', { matchCase: false }).click({ force: true });
    cy.wait(2000);

    cy.contains('button', /export|download/i).click({ force: true });
    cy.wait(3000);

    cy.task('findFiles', { folder: downloadsFolder, mask: '.xlsx' }).then((files) => {
      const fileName = files[0];
      // Skenario 3: Nama file harus mengandung kata 'District'
      expect(fileName.toLowerCase()).to.include('district', '🚨 BUG: Nama file tidak deskriptif (Missing "District" word)');

      const filePath = `${downloadsFolder}/${fileName}`;
      cy.task('parseXlsx', { filePath }).then((excelData) => {
        const sheetContent = JSON.stringify(excelData[0].data);
        // Skenario 2: Kolom harus berisi District/Kecamatan
        expect(sheetContent).to.include('District');
        expect(sheetContent).to.include('Sukolilo');
      });
    });
  });
  it('CASE 4: Validasi Perilaku Export Saat Data Tidak Ditemukan', () => {
    cy.get(searchInput).clear({ force: true }).type('DataNgawur12345', { force: true });
    cy.wait(1000);
    cy.contains('Showing', { matchCase: false }).should('contain.text', '0-0');

    cy.contains('button', /export|download/i).then(($btn) => {
      if ($btn.is(':disabled')) {
        cy.log('✅ Tombol Disabled saat data kosong.');
      } else {
        cy.wrap($btn).click({ force: true });
        cy.wait(2000);
        cy.task('findFiles', { folder: downloadsFolder, mask: '.xlsx' }).then((files) => {
          const filePath = `${downloadsFolder}/${files[0]}`;
          cy.task('parseXlsx', { filePath }).then((excelData) => {
            // Hanya boleh ada 1 baris (Header saja)
            expect(excelData[0].data.length).to.be.at.most(1);
          });
        });
      }
    });
  });
  it('CASE PAGINATION: Export Harus Mengambil Seluruh Data (Semua Halaman)', () => {
    // 1. Ambil angka total data dari teks pagination di UI (misal: "of 102 stores")
    cy.get('div').contains(/of\s*\d+\s*stores/i).invoke('text').then((text) => {
      // Ambil angka menggunakan Regex (mencari angka setelah kata 'of')
      const totalInUI = parseInt(text.match(/of\s*(\d+)/i)[1]);
      cy.log(`🎯 Total data terdeteksi di UI: ${totalInUI}`);

      // 2. Klik Export tanpa melakukan filter apa pun
      cy.contains('button', /export|download/i).click({ force: true });
      cy.wait(5000); // Beri waktu lebih lama karena data besar (102 baris)

      // 3. Validasi isi Excel
      cy.task('findFiles', { folder: downloadsFolder, mask: '.xlsx' }).then((files) => {
        const filePath = `${downloadsFolder}/${files[0]}`;
        cy.task('parseXlsx', { filePath }).then((excelData) => {
          const rowCountInExcel = excelData[0].data.length - 1; // Kurangi 1 untuk Header
          
          cy.log(`📄 Total baris data di Excel: ${rowCountInExcel}`);

          // ASERSi UTAMA: Jumlah data di Excel harus SAMA dengan total data di UI
          // Jika Excel cuma berisi 25 baris padahal di UI ada 102, berarti BUG PAGINATION!
          expect(rowCountInExcel).to.eq(totalInUI, 
            `🚨 BUG EXPORT: File Excel hanya mengunduh halaman pertama (${rowCountInExcel} baris), seharusnya ${totalInUI} baris!`
          );
        });
      });
    });
  });
});