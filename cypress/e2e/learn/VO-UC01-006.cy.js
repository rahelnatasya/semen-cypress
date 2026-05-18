describe('Visit Overview - Search Bar Validation', () => {
  
  beforeEach(() => {
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('WebSocket')) return false; 
      return true; 
    });

    // Proses Login
    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    cy.get('input[type="email"]').type('admin@admin.com', { force: true })
    cy.get('input[type="password"]').type('admin123!', { force: true }) 
    cy.get('button[type="submit"]').click({ force: true })
    cy.url().should('eq', 'http://pepi-semen.inaai.ai:5173/')

    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview') 
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000)
  })

  it('Verifikasi fitur Search dan Tampilan Kosong pada mode Store dan District (Happy Path)', () => {
    
    // 1. SETUP: Mocking Data agar hasil pencarian bisa diprediksi
    cy.intercept('GET', '**/visit-heatmap*groupBy=store*', (req) => {
      req.continue((res) => {
        if (res.body) {
          // Kita siapkan dua toko spesifik untuk dites
          res.body.data = [
            { id: 1, label: "TOKO SUPER MAKMUR", kecamatan: "Sukolilo" },
            { id: 2, label: "TOKO BINTANG JAYA", kecamatan: "Rungkut" }
          ];
        }
        res.send(res.body);
      })
    }).as('getHeatmapStore')

    cy.intercept('GET', '**/visit-heatmap*groupBy=district*', (req) => {
      req.continue((res) => {
        if (res.body) {
          // Kita siapkan dua kecamatan spesifik untuk dites
          res.body.data = [
            { id: "A1", label: "Sukolilo", kecamatan: "Sukolilo" },
            { id: "B2", label: "Rungkut", kecamatan: "Rungkut" }
          ];
        }
        res.send(res.body);
      })
    }).as('getHeatmapDistrict')

    // Buka Halaman Visit Overview
    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview') 
    cy.wait('@getHeatmapStore')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000) // Tunggu tabel ter-render dengan sempurna

    // Targetkan kolom Search berdasarkan placeholder
    const searchInput = 'input[placeholder="Search..."]';


    // 2. PENGUJIAN MODE: STORE
    cy.log('--- MENGUJI SEARCH MODE STORE ---');
    
    // a. Skenario Valid: Pencarian Toko Sesuai Data
    cy.get(searchInput).clear({ force: true }).type('SUPER MAKMUR', { force: true })
    cy.wait(500) // Waktu untuk filter (debounce) bereaksi
    
    // Tabel harus memunculkan toko yang dicari, dan menghilangkan toko yang tidak relevan
    cy.get('table').contains('TOKO SUPER MAKMUR', { matchCase: false }).should('be.visible')
    cy.get('table').should('not.contain', 'TOKO BINTANG JAYA')

    // b. Skenario Invalid: Pencarian Toko Tidak Ditemukan (Empty State)
    cy.get(searchInput).clear({ force: true }).type('GINTING JAYA', { force: true })
    cy.wait(500)
    
    // Memastikan tidak ada data yang bocor tampil
    cy.get('table').should('not.contain', 'TOKO SUPER MAKMUR')
    cy.get('table').should('not.contain', 'TOKO BINTANG JAYA')
    // Verifikasi tampilan Empty State (Biasanya ada pesan No Data / Not Found)
    // Silakan sesuaikan teks di bawah ini dengan pesan Empty State bawaan aplikasimu
    cy.contains('Showing', { matchCase: false })
      .should('contain.text', '0-0')
      .and('be.visible')
      
    // 3. PENGUJIAN MODE: DISTRICT
    cy.log('--- MENGUJI SEARCH MODE DISTRICT ---');
    
    // Ubah ke mode District
    cy.contains('button[role="tab"]', 'District', { matchCase: false }).click({ force: true })
    cy.wait('@getHeatmapDistrict')
    cy.wait(1000)

    // c. Skenario Valid: Pencarian Kecamatan Sesuai Data
    cy.get(searchInput).clear({ force: true }).type('Rungkut', { force: true })
    cy.wait(500)
    
    cy.get('table').contains('Rungkut', { matchCase: false }).should('be.visible')
    cy.get('table').should('not.contain', 'Sukolilo')

    // d. Skenario Invalid: Pencarian Kecamatan Tidak Ditemukan (Empty State)
    cy.get(searchInput).clear({ force: true }).type('Balige', { force: true })
    cy.wait(500)
    
    cy.get('table').should('not.contain', 'Rungkut')
    // Verifikasi Empty State lagi
    cy.contains('Showing', { matchCase: false })
      .should('contain.text', '0-0')
      .and('be.visible')

    cy.log('✅ Fitur Search Bar berfungsi sempurna di kedua mode!');
  })
  // SKENARIO 1: INPUT SILUMAN (Whitespace & XSS)
  it('SKENARIO 1: Menangani input Spasi Murni dan Karakter Khusus (XSS) dengan aman [BUG]', () => {

    const searchInput = 'input[placeholder="Search..."]';
    
    cy.log('--- SKENARIO 1A: SPASI MURNI ---');
    // Ngetik spasi 5 kali. Sistem harus nge-trim ini jadi string kosong.
    cy.get(searchInput).clear({ force: true }).type('     ', { force: true })
    cy.wait(1000)
    
    // Validasi: Tabel tidak boleh jadi Empty State. Data awal harus tetap muncul.
    // (Asumsi jika data tidak kosong, indikator halaman bukan 1 / 0)
    cy.contains('Showing', { matchCase: false })
      .should('not.contain.text', '0-0')
      .and('be.visible') // Pastikan tabel tetap tampil dengan data awal

    cy.log('--- SKENARIO 1B: KARAKTER KHUSUS & XSS ---');
    // Ngetik script jahat
    cy.get(searchInput).clear({ force: true }).type("<script>alert('bug')</script>!@#$", { force: true })
    cy.wait(1000)
    
    // Validasi: Aplikasi tidak crash (layar putih) dan dengan tenang menampilkan Empty State
    cy.get('body').should('not.be.empty') // Pastikan tidak White Screen
  
    cy.contains('Showing', { matchCase: false })
      .should('contain.text', '0-0')
      .and('be.visible') // Tabel menampilkan indikator data kosong
  })

  // 2. KATEGORI: KETAHANAN PERFORMA (Debounce & Spam)
  it('SKENARIO 2: Menguji Progressive Local Search (Filter instan setiap tambahan huruf)', () => {

    const searchInput = 'input[placeholder="Search..."]';

    // Buka tab District untuk pengujian ini
    cy.contains('button[role="tab"]', 'District', { matchCase: false }).click({ force: true })
    cy.wait(1000)

    cy.log('--- UJI KETIKAN AWAL: "S" ---');
    // Cypress mengetik 1 huruf pelan-pelan
    cy.get(searchInput).clear({ force: true }).type('S', { force: true })
    cy.wait(200) // Jeda visual sesaat
    
    // Validasi: Tabel harus langsung bereaksi. 
    // Kecamatan berawalan 'S' (Sukolilo, Sambikerep, Sawahan) harus ada.
    cy.get('table').contains('Sukolilo', { matchCase: false }).scrollIntoView().should('be.visible')
    cy.get('table').contains('Sawahan', { matchCase: false }).scrollIntoView().should('be.visible')

    cy.log('--- UJI LANJUTAN: DARI "S" MENJADI "SUK" ---');
    // Cypress melanjutkan ketikan tanpa menghapus huruf 'S' sebelumnya
    cy.get(searchInput).type('UK', { force: true }) // Sekarang kolom berisi 'SUK'
    cy.wait(200)
    
    // Validasi: Tabel menyempit. 'Sukolilo' masih ada, tapi 'Sawahan' harus HILANG!
    cy.get('table').contains('Sukolilo', { matchCase: false }).scrollIntoView().should('be.visible')
    cy.get('table').should('not.contain', 'Sawahan') // Sawahan tidak mengandung unsur 'SUK'

    cy.log('--- UJI LANJUTAN: DARI "SUK" MENJADI "SUKOLILO" ---');
    cy.get(searchInput).type('OLILO', { force: true }) // Sekarang kolom berisi 'SUKOLILO'
    cy.wait(200)

    // Validasi Akurasi Akhir
    cy.get('table').contains('Sukolilo', { matchCase: false }).scrollIntoView().should('be.visible')
    // Memastikan tidak ada kecamatan lain yang bocor
    cy.get('table').should('not.contain', 'Rungkut')
    cy.get('table').should('not.contain', 'Tandes')
  })

  // SKENARIO 3: JEBAKAN STATE (Gagal Reset / Backspace)
  it('SKENARIO 3: Tabel segera pulih (Reset) saat kolom pencarian kembali dikosongkan', () => {

    const searchInput = 'input[placeholder="Search..."]';
    // Langkah 1: Buat tabel jadi kosong dulu
    cy.get(searchInput).clear({ force: true }).type('KataKunciPastiKosong', { force: true })
    cy.wait(1000)
    cy.contains('1 / 0').should('be.visible') // Pastikan Empty State aktif
    
    // Langkah 2: Hapus bersih kolom pencarian dengan cepat (Select All + Backspace)
    cy.get(searchInput).type('{selectall}{backspace}', { force: true })
    cy.wait(1500) // Beri waktu Frontend merespon perubahan string kosong

    // Validasi: Empty State harus hilang. Data harus kembali ke wujud aslinya.
    cy.contains('1 / 0').should('not.exist')
  })

  // SKENARIO 4: BATAS LIMITAN (Overflow / Max Length)
  it('SKENARIO 4: Kolom Search membatasi input atau menahan error dari Teks Sangat Panjang', () => {
    
    const searchInput = 'input[placeholder="Search..."]';
    // Buat string panjang 2000 karakter
    const superLongText = 'A'.repeat(2000);

    // Tempel (Paste) teks tersebut ke dalam kolom pencarian
    cy.get(searchInput).clear({ force: true })
      .invoke('val', superLongText) // Trik paste cepat via invoke value
      .trigger('input') // Memicu event React untuk menyadari perubahan input
      .type('{enter}', { force: true }) // Paksa trigger pencarian

    cy.wait(2000)

    // Validasi A: Cek apakah developer membatasi jumlah karakter di HTML (maxlength)
    cy.get(searchInput).invoke('val').then((val) => {
      // Jika panjang value masih 2000, artinya developer LUPA memasang maxlength
      if (val.length === 2000) {
        cy.log('⚠️ WARNING: Input tidak memiliki pembatasan maxlength (Celah Keamanan).');
        
        // Jika tidak dibatasi, setidaknya aplikasi tidak meledak (Error 414 URI Too Long yang bikin White Screen)
        cy.get('body').should('not.be.empty')
        cy.contains('Visit Overview').should('be.visible')
      } else {
        // Jika dibatasi (misal dipotong jadi 100 karakter), maka UI aman
        expect(val.length).to.be.lessThan(256, 'Karakter berhasil dibatasi oleh Frontend.');
      }
    })
  })
})


//[BUG] Search Bar tidak mengabaikan spasi kosong, ketika pengguna tidak sengaja mengetik spasi kosong di kolom pencarian, sistem 
//memproses sebagai karakter yang valid, sehingga menghasilkan tabel dengan nilai kosong. 

