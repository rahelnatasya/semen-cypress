const fs = require('fs');
const path = require('path');
const nodeXlsx = require('node-xlsx'); // Tambahkan ini di paling atas

module.exports = {
  e2e: {
    setupNodeEvents(on, config) {
      on('task', {
        
        // Task 1: Mencari file (sudah kita buat sebelumnya)
        findFiles({ folder, mask }) {
          if (!fs.existsSync(folder)) return [];
          const files = fs.readdirSync(folder);
          const extension = mask.replace('*', ''); 
          return files.filter((file) => file.endsWith(extension));
        },

        // Task 2: MEMBACA ISI FILE EXCEL!
        parseXlsx({ filePath }) {
          return new Promise((resolve, reject) => {
            try {
              // Membaca file biner dan mengubahnya menjadi array data JSON
              const excelData = nodeXlsx.parse(fs.readFileSync(filePath));
              resolve(excelData);
            } catch (error) {
              reject(error);
            }
          });
        }
        
      })
    },
  },
};