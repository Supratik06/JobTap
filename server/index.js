import app from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Acdyon Resilient Ingestion Server running on port ${PORT}`);
  console.log(`📡 SSE Stream: http://localhost:${PORT}/api/events`);
  console.log(`🛡️  Stealth Engine: Active (BoringSSL & Browser Emulation)`);
  console.log(`⚡ Circuit Breakers: Armed and Monitoring`);
  console.log(`======================================================\n`);
});
