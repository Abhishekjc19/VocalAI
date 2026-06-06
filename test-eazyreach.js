import dotenv from "dotenv";
dotenv.config();

const CLIENT_ID = process.env.EAZYREACH_CLIENT_ID;
const CLIENT_SECRET = process.env.EAZYREACH_CLIENT_SECRET;
const BASE_URL = "https://studio.eazyreach.app/api";

console.log("Testing Eazyreach OAuth2...");
console.log("Client ID:", CLIENT_ID ? "Present" : "Missing");
console.log("Client Secret:", CLIENT_SECRET ? "Present" : "Missing");

// Test OAuth token
console.log(`\nTrying: ${BASE_URL}/auth/token`);

try {
  const response = await fetch(`${BASE_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials"
    }),
  });

  console.log(`Status: ${response.status}`);
  const text = await response.text();
  console.log(`Response:`, text);
  
  if (response.ok) {
    const data = JSON.parse(text);
    console.log("\n✅ OAuth token received!");
    console.log("Access token:", data.access_token?.slice(0, 20) + "...");
  }
} catch (err) {
  console.log(`Error: ${err.message}`);
}
