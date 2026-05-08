describe('Login Authentication', () => {
  
  before(() => {
    // Menyembunyikan error WebSocket dari Vite HMR
    Cypress.on('uncaught:exception', (err, runnable) => {
      if (err.message.includes('WebSocket')) {
        return false; 
      }
      return true; 
    });
  })

  // --- SKENARIO 1: POSITIVE TEST ---
  it('Login dengan kombinasi email & password yang sesuai', () => {
    // Kunjungi halaman login
    cy.visit('http://pepi-semen.inaai.ai:5173/login')

    // 1. Isi Textbox Email
    cy.get('input[type="email"]').type('admin@admin.com')

    // 2. Isi Textbox Password
    cy.get('input[type="password"]').type('admin123!')

    // 3. Submit Form
    cy.get('button').contains('Sign In')
      .should('be.visible')
      .click({ force: true })
    
    // 4. Verifikasi
    cy.url().should('eq', 'http://pepi-semen.inaai.ai:5173/')
  })

  // --- SKENARIO 2: NEGATIVE TEST (Format Email Salah) ---
    it('Login dengan kombinasi email tidak tepat', () => {

    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    cy.get('input[type="email"]').type('adminadmin.com') 
    cy.get('input[type="password"]').type('admin123!')
    cy.get('button').contains('Sign In').should('be.visible').click({ force: true })
    
    // Verifikasi tetap di halaman login karena email tidak valid
    cy.url().should('include', '/login')
  })

  // --- SKENARIO 3: NEGATIVE TEST (Password Salah) ---
  it('Login dengan kombinasi password tidak tepat', () => {

    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    cy.get('input[type="email"]').type('admin@admin.com') 
    cy.get('input[type="password"]').type('wrongpassword')
    cy.get('button').contains('Sign In').should('be.visible').click({ force: true })

    // Verifikasi 1: tetap di halaman login karena password tidak valid
    cy.url().should('include', '/login')
    // Verifikasi 2: Muncul pesan error validasi email di layar
    cy.contains('Invalid email or password. Please try again.').should('be.visible')
  })

  // --- SKENARIO 3: NEGATIVE TEST (Password Salah / Tidak Terdaftar) ---
  it('Login dengan email benar tapi password salah', () => {

    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    cy.get('input[type="email"]').type('admin@admin.com')
    // Sengaja masukkan password yang salah
    cy.get('input[type="password"]').type('password_salah_123') 
    cy.get('button').contains('Sign In').should('be.visible').click({ force: true })
    
    // Verifikasi 1: URL TETAP di halaman login
    cy.url().should('include', '/login')
    
    // Verifikasi 2: Muncul pesan error dari server (Alert merah)
    // Sesuai dengan setServerError() di kode React kamu
    cy.contains('Invalid email or password. Please try again.').should('be.visible')
  })

  // --- SKENARIO 4: NEGATIVE TEST (Form Kosong) ---
  it('Gagal login jika form dikosongkan', () => {

    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    // Langsung klik tombol tanpa mengisi apapun
    cy.get('button').contains('Sign In').should('be.visible').click({ force: true })
    
    // Verifikasi URL tetap di login
    cy.url().should('include', '/login')
    
    // Verifikasi kedua pesan error required muncul
    cy.contains('Email is required').should('be.visible')
    cy.contains('Password is required').should('be.visible')
  })

})