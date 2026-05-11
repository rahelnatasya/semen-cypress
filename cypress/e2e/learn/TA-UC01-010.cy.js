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

      // 5. VALIDASI UI BERDASARKAN DATA API (Tepat Sasaran!)
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

      // 6. Validasi tambahan (Breadcrumb)
      cy.get('.px-4.pt-1.pb-2')
        .should('contain', 'Explore')
        .and('contain', targetKecamatan)
      
      // 7. Verifikasi tombol navigasi kembali muncul
      cy.contains('button', 'Back to All Kecamatan').should('be.visible')

      cy.log(`✅ Sempurna! Data ${targetKecamatan} dari API memiliki ${expectedStoreCount} toko, dan UI berhasil menampilkannya.`);
    })
  })
  // --- SKENARIO 1: DATA PETA TIDAK LENGKAP (GEOMETRY HILANG) ---
  it('Skenario 1: UI tidak crash (White Screen) saat koordinat/geometry kecamatan hilang', () => {
    const targetKecamatan = 'Sukolilo';

    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', (req) => {
      req.continue((res) => {
        if (res.body && res.body.districts) {
          const districtIndex = res.body.districts.findIndex(d => d.name === targetKecamatan);
          if (districtIndex !== -1) {
            // Meracuni data: Hapus koordinat agar Leaflet kebingungan
            res.body.districts[districtIndex].geometry = null;
            res.body.districts[districtIndex].bbox = null;
          }
        }
        res.send(res.body);
      })
    }).as('getBrokenGeo')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getBrokenGeo')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000)

    // Interaksi UI
    cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
    cy.wait(500) 
    cy.contains('label', 'Kecamatan', { matchCase: false }).parent().find('input[type="text"]').click({ force: true }).clear({ force: true }).type(targetKecamatan, { force: true })
    cy.wait(500) 
    cy.get('body').contains(targetKecamatan).not('input').last().click({ force: true })

    // VALIDASI: Memastikan aplikasi tidak white screen
    cy.contains('Territory Analytics').should('be.visible')
    // Memastikan panel ringkasan (angka 7) tetap dirender meskipun peta gagal zoom
    cy.get('.p-4.border-b.border-slate-100').should('be.visible')
  })


  // --- SKENARIO 2: INKONSISTENSI DATA (SUMMARY VS PIN PETA) ---
  it('Skenario 2: Menangkap Bug jika jumlah Pin di peta tidak sama dengan Angka di Panel', () => {
    const targetKecamatan = 'Sukolilo';

    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', (req) => {
      req.continue((res) => {
        if (res.body && res.body.stores) {
          
          const districtIndex = res.body.districts.findIndex(d => d.name === targetKecamatan);
          if (districtIndex !== -1) {
            res.body.districts[districtIndex].storeCount = 7; // Paksa panel bilang 7
          }

          // 1. Ambil data asli Sukolilo
          const sukoliloStoresAsli = res.body.stores.filter(s => s.districtName === targetKecamatan);
          
          // 2. Sunat jadi tinggal 3 toko
          const storesPalsu = sukoliloStoresAsli.slice(0, 3);
          
          // 3. TRIK DEWA: Kita ubah koordinat ketiga toko ini agar berjauhan!
          // Dengan begitu, Leaflet TIDAK MUNGKIN membuat mereka jadi cluster.
          if(storesPalsu[0]) { storesPalsu[0].latitude = -7.28; storesPalsu[0].longitude = 112.76; } // Geser agak ke Barat
          if(storesPalsu[1]) { storesPalsu[1].latitude = -7.30; storesPalsu[1].longitude = 112.79; } // Geser ke Tengah
          if(storesPalsu[2]) { storesPalsu[2].latitude = -7.32; storesPalsu[2].longitude = 112.81; } // Geser agak ke Timur
          
          res.body.stores = storesPalsu;
        }
        res.send(res.body);
      })
    }).as('getInconsistentData')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getInconsistentData')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000)

    cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
    cy.wait(500) 
    cy.contains('label', 'Kecamatan', { matchCase: false }).parent().find('input[type="text"]').click({ force: true }).clear({ force: true }).type(targetKecamatan, { force: true })
    cy.wait(500) 
    cy.get('body').contains(targetKecamatan).not('input').last().click({ force: true })
    cy.wait(2000) // Peta merender 3 titik yang letaknya berjauhan

    // VALIDASI INTEGRITAS DATA
cy.get('.p-4.border-b.border-slate-100').within(() => {
      cy.contains('.rounded-lg', 'Stores', { matchCase: false })
        .find('.text-lg.font-bold')
        .invoke('text')
        .then((uiStoreCount) => {
          
          const angkaDiPanel = parseInt(uiStoreCount); // Angka 3

          cy.document().then((doc) => {
            // PERBAIKAN: Kita JANGAN pakai .leaflet-marker-icon secara umum.
            // Kita pakai 'polyline' untuk memastikan yang dihitung HANYA ikon toko berbentuk rumah.
            const pinTokoAsli = doc.querySelectorAll('.leaflet-marker-pane svg polyline[points="9 22 9 12 15 12 15 22"]');
            
            cy.log(`Cypress menemukan ${pinTokoAsli.length} ikon rumah di peta.`);
            expect(pinTokoAsli.length).to.eq(angkaDiPanel, 'Jumlah IKON RUMAH di peta HARUS SAMA dengan angka di panel!');
          })
        })
    })
  })

  // --- SKENARIO 3: KECAMATAN HANTU (NULL SCORES) ---
  it('Skenario 3: UI Fallback berfungsi aman saat data Score (A,B,C) tidak dikirim', () => {
    const targetKecamatan = 'Sukolilo';

    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', (req) => {
      req.continue((res) => {
        if (res.body && res.body.districts) {
          const districtIndex = res.body.districts.findIndex(d => d.name === targetKecamatan);
          if (districtIndex !== -1) {
            // Hapus/Null-kan data score
            res.body.districts[districtIndex].rankA = undefined;
            res.body.districts[districtIndex].rankB = undefined;
            res.body.districts[districtIndex].rankC = undefined;
          }
        }
        res.send(res.body);
      })
    }).as('getGhostDistrict')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getGhostDistrict')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000)

    cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
    cy.wait(500) 
    cy.contains('label', 'Kecamatan', { matchCase: false }).parent().find('input[type="text"]').click({ force: true }).clear({ force: true }).type(targetKecamatan, { force: true })
    cy.wait(500) 
    cy.get('body').contains(targetKecamatan).not('input').last().click({ force: true })
    cy.wait(2000)

    // VALIDASI: Panel menampilkan angka 0, bukan tulisan "undefined" atau layar nge-blank
    cy.get('.p-4.border-b.border-slate-100').within(() => {
      cy.contains('Score A').parent().should('not.contain', 'undefined')
      cy.contains('Score B').parent().should('not.contain', 'undefined')
    })
  })


  // --- SKENARIO 4: KONFLIK STATE (BALAPAN FILTER & BACK BUTTON) ---
  it('Skenario 4: State aplikasi tidak bocor saat "Back to All Kecamatan" diklik secara brutal', () => {
    const targetKecamatan = 'Sukolilo';
    
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getAnalytics')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getAnalytics')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000)

    cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
    cy.wait(500) 
    cy.contains('label', 'Kecamatan', { matchCase: false }).parent().find('input[type="text"]').click({ force: true }).clear({ force: true }).type(targetKecamatan, { force: true })
    cy.wait(500) 
    cy.get('body').contains(targetKecamatan).not('input').last().click({ force: true })

    // TINDAKAN BRUTAL: Belum juga selesai animasi, user langsung klik Back!
    cy.contains('button', 'Back to All Kecamatan').click({ force: true })
    cy.wait(1000)

    // VALIDASI: Panel detail Sukolilo harus MUSNAH dari layar
    cy.get('.p-4.border-b.border-slate-100').should('not.exist')
    // Breadcrumb kembali ke All Zone (Tidak mengandung Sukolilo)
    cy.get('.px-4.pt-1.pb-2').should('not.contain', targetKecamatan)
  })


  // --- SKENARIO 5: INJEKSI KARAKTER ANEH DI PENCARIAN ---
it('Skenario 5: Dropdown filter tidak rusak/freeze saat dimasukkan karakter aneh', () => {
    
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getAnalytics')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getAnalytics')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000)

    cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
    cy.wait(500) 
    
    // Injeksi karakter XSS (Cross-Site Scripting)
    const xssString = "<script>alert(1)</script>!@#$%";

    cy.contains('label', 'Kecamatan', { matchCase: false })
      .parent()
      .find('input[type="text"]')
      .click({ force: true })
      .clear({ force: true })
      .type(xssString, { force: true })
    
    cy.wait(500) // Waktu agar dropdown merespons ketikan

    // VALIDASI YANG BENAR: 
    // Kita tidak mengecek <body>, tapi kita ngecek apakah kotak inputnya benar-benar 
    // bisa menerima karakter aneh tanpa crash, dan memastikan tidak ada "opsi dropdown" Sukolilo yang muncul.
    
    // 1. Pastikan aplikasi tidak crash (UI utama masih hidup)
    cy.contains('Territory Analytics').should('be.visible')
    
    // 2. Pastikan elemen yang sejajar dengan input (area dropdown) tidak memunculkan kata Sukolilo
    cy.contains('label', 'Kecamatan', { matchCase: false })
      .parent()
      .should('not.contain', 'Sukolilo')
      
    // 3. (Opsional) Jika saat pencarian tidak ditemukan aplikasimu memunculkan teks "Not Found", 
    // kamu bisa tambahkan asersi ini:
    // cy.contains('No options', { matchCase: false }).should('be.visible') 
  })
})