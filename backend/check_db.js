const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'trips.db'));

db.all('SELECT * FROM confirmed_trips', [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log(`Found ${rows.length} confirmed trips.`);
        console.log(JSON.stringify(rows, null, 2));
    }
    db.close();
});
