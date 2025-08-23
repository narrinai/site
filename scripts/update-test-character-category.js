// Update test character category to mentorship
const fetch = require('node-fetch');

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;

async function updateTestCharacterCategory() {
  try {
    console.log('🔍 Finding test-test-rr3z character...');
    
    // First, find the record ID for test-test-rr3z
    const listUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula={Slug}="test-test-rr3z"`;
    
    const listResponse = await fetch(listUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const listData = await listResponse.json();
    
    if (!listData.records || listData.records.length === 0) {
      console.log('❌ Character test-test-rr3z not found');
      return;
    }
    
    const record = listData.records[0];
    console.log('✅ Found character:', record.fields.Name);
    console.log('📋 Current category:', record.fields.Category || 'EMPTY');
    
    // Update the category to 'mentorship'
    const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${record.id}`;
    
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          Category: 'life'
        }
      })
    });
    
    const updateData = await updateResponse.json();
    
    if (updateResponse.ok) {
      console.log('✅ Successfully updated category to:', updateData.fields.Category);
    } else {
      console.error('❌ Failed to update:', updateData);
    }
    
  } catch (error) {
    console.error('❌ Error updating character category:', error);
  }
}

updateTestCharacterCategory();