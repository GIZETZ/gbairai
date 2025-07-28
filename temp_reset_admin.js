
const https = require('https');
const { URL } = require('url');

console.log('🚀 Démarrage du script de réinitialisation admin...');

const data = JSON.stringify({
  "newPassword": "Gb@irai.Ci.0192*2025",
  "adminKey": "RESET_ADMIN_2025"
});

// Construire l'URL en utilisant les variables d'environnement
const replOwner = process.env.REPL_OWNER || process.env.REPL_SLUG;
console.log('📍 REPL_OWNER:', replOwner);

if (!replOwner) {
  console.error('❌ REPL_OWNER non défini dans les variables d\'environnement');
  process.exit(1);
}

const urlString = `https://workspace.${replOwner}.repl.co/api/admin/reset-password`;
console.log(`🌐 URL cible: ${urlString}`);

let parsedUrl;
try {
  parsedUrl = new URL(urlString);
  console.log('✅ URL parsée avec succès');
} catch (error) {
  console.error('❌ Erreur parsing URL:', error.message);
  process.exit(1);
}

const options = {
  hostname: parsedUrl.hostname,
  port: parsedUrl.port || 443,
  path: parsedUrl.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'User-Agent': 'Admin-Reset-Script/1.0'
  },
  timeout: 10000
};

console.log('📋 Options de requête:', {
  hostname: options.hostname,
  port: options.port,
  path: options.path,
  method: options.method
});

console.log('📤 Envoi de la requête...');

const req = https.request(options, (res) => {
  console.log(`📊 Status: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  
  let responseBody = '';
  res.on('data', (chunk) => {
    responseBody += chunk;
    console.log('📥 Données reçues:', chunk.toString());
  });
  
  res.on('end', () => {
    console.log('📝 Réponse complète:', responseBody);
    
    try {
      const parsed = JSON.parse(responseBody);
      console.log('📦 Réponse parsée:', parsed);
    } catch (e) {
      console.log('⚠️ Impossible de parser la réponse JSON');
    }
    
    if (res.statusCode === 200) {
      console.log('✅ Mot de passe admin réinitialisé avec succès!');
    } else {
      console.log('❌ Erreur lors de la réinitialisation');
    }
    
    console.log('🏁 Script terminé');
  });
});

req.on('error', (error) => {
  console.error('❌ Erreur requête:', error.message);
  console.error('🔍 Détails erreur:', error);
});

req.on('timeout', () => {
  console.error('⏰ Timeout de la requête');
  req.destroy();
});

console.log('📤 Envoi des données...');
req.write(data);
req.end();

console.log('⏳ Attente de la réponse...');
