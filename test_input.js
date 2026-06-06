console.log('Script started');
console.log('stdin.isTTY:', process.stdin.isTTY);

if (!process.stdin.isTTY) {
  console.log('Reading from piped stdin...');
  let data = "";
  process.stdin.on("data", (chunk) => {
    console.log('Got data chunk:', chunk.toString());
    data += chunk.toString();
  });
  process.stdin.on("end", () => {
    console.log('Got end event, data:', data.trim());
  });
  process.stdin.on("error", (err) => {
    console.error('stdin error:', err);
  });
  
  // Timeout fallback
  setTimeout(() => {
    console.log('Timeout reached');
    process.exit(1);
  }, 3000);
} else {
  console.log('TTY mode');
  process.exit(0);
}
