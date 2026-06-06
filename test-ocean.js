import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.OCEAN_API_KEY;
const seedDomain = "stripe.com";

console.log("Testing Ocean.io API...");
console.log("API Key:", API_KEY ? "Present" : "Missing");

// Test different endpoints
const endpoints = [
  "https://api.ocean.io/lookalikes",
  "https://api.ocean.io/v1/lookalikes",
  "https://api.ocean.io/v2/lookalikes",
  "https://api.ocean.io/companies/lookalikes",
];

for (const endpoint of endpoints) {
  console.log(`\nTrying: ${endpoint}`);
  
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        seed_domain: seedDomain,
        limit: 5,
      }),
    });

    console.log(`Status: ${response.status}`);
    const text = await response.text();
    console.log(`Response: ${text.slice(0, 200)}`);
    
    if (response.ok) {
      console.log("✅ THIS ENDPOINT WORKS!");
      break;
    }
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
}
