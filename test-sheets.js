import { appendUserToSheet } from './backend/googleSheets.js';

async function test() {
    console.log("Testing Google Sheets...");
    try {
        await appendUserToSheet({
            id: 1234567890,
            first_name: "Test User",
            last_name: "Test Lastname",
            username: "testuser"
        });
        console.log("Done testing.");
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
