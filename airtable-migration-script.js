// Airtable Script om ChatHistory User links bij te werken
// Dit script kun je runnen in de Airtable Scripting extension

// Tabellen ophalen
const chatHistoryTable = base.getTable('ChatHistory');
const usersTable = base.getTable('Users');

// Alle users ophalen met hun NetlifyUID
const usersQuery = await usersTable.selectRecordsAsync({
    fields: ['NetlifyUID', 'User_ID']
});

// Maak een mapping van User_ID naar Record ID
const userIdToRecordId = {};
for (let userRecord of usersQuery.records) {
    const userId = userRecord.getCellValue('User_ID');
    if (userId) {
        userIdToRecordId[userId] = userRecord.id;
    }
}

// ChatHistory records ophalen
const chatHistoryQuery = await chatHistoryTable.selectRecordsAsync({
    fields: ['User', 'Name (old)']
});

// Updates verzamelen
const updates = [];
let processedCount = 0;
let skippedCount = 0;

for (let record of chatHistoryQuery.records) {
    const currentUser = record.getCellValue('User');
    
    // Als er al een User linked is, kunnen we deze skippen
    if (currentUser && currentUser.length > 0) {
        // Check of het de juiste user is via NetlifyUID
        // Dit is alleen nodig als je wilt verifiëren
        skippedCount++;
        continue;
    }
    
    // Probeer User_ID te vinden in de oude Name field of een ander veld
    // Pas dit aan op basis van waar de oude User_ID staat
    const recordName = record.getCellValue('Name (old)');
    
    // Extract User_ID uit de naam (aanpassen aan jouw formaat)
    // Bijvoorbeeld als naam is "user123_char456_timestamp"
    const userIdMatch = recordName ? recordName.match(/user_([^_]+)/) : null;
    
    if (userIdMatch) {
        const oldUserId = userIdMatch[1];
        const newUserRecordId = userIdToRecordId[oldUserId];
        
        if (newUserRecordId) {
            updates.push({
                id: record.id,
                fields: {
                    'User': [{id: newUserRecordId}]
                }
            });
            processedCount++;
        }
    }
}

// Updates uitvoeren in batches van 50
console.log(`Te updaten records: ${updates.length}`);
console.log(`Overgeslagen records: ${skippedCount}`);

if (updates.length > 0) {
    const batchSize = 50;
    for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        await chatHistoryTable.updateRecordsAsync(batch);
        console.log(`Batch ${Math.floor(i/batchSize) + 1} verwerkt`);
    }
}

console.log('✅ Migratie voltooid!');
console.log(`📊 Totaal verwerkt: ${processedCount} records`);