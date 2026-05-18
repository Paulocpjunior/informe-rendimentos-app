// ============================================================================
// src/utils/cert-loader.js
// Carrega o certificado A1 da SP Assessoria (procuradora) do Secret Manager
// do projeto consultorfiscalapp e extrai cert+chave em PEM para o assinador.
//
// Le os secrets:
//   - sefaz-cert-a1        : conteudo binario do .pfx (PKCS#12)
//   - sefaz-cert-password  : senha do .pfx
// Ambos no projeto consultorfiscalapp. A service account do sp-contabil-api
// tem permissao secretAccessor nesses dois secrets.
//
// IMPORTANTE: a senha e o .pfx NUNCA sao logados nem persistidos. So PEM
// fica em cache de memoria, por 5 minutos.
// ============================================================================
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const forge = require('node-forge');

const CERT_PROJECT = process.env.CERT_PROJECT_ID || 'consultorfiscalapp';
const SECRET_CERT  = process.env.SEFAZ_CERT_NAME || 'sefaz-cert-a1';
const SECRET_PASS  = process.env.SEFAZ_PASS_NAME || 'sefaz-cert-password';
const CACHE_TTL_MS = 5 * 60 * 1000;

const client = new SecretManagerServiceClient();
let cache = null;

/**
 * Extrai chave privada e certificado folha em PEM a partir do .pfx (PKCS#12).
 * O xml-crypto exige PEM — nao aceita .pfx direto.
 */
function extrairPem(pfxBuffer, password) {
  const asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  let pemKey = null;
  let pemCert = null;
  for (const sc of p12.safeContents) {
    for (const bag of sc.safeBags) {
      if (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag || bag.type === forge.pki.oids.keyBag) {
        if (bag.key) pemKey = forge.pki.privateKeyToPem(bag.key);
      } else if (bag.type === forge.pki.oids.certBag) {
        // primeiro cert = folha (o do CNPJ); ignora a cadeia ICP-Brasil
        if (!pemCert && bag.cert) pemCert = forge.pki.certificateToPem(bag.cert);
      }
    }
  }
  if (!pemKey)  throw new Error('cert-loader: chave privada nao encontrada no .pfx');
  if (!pemCert) throw new Error('cert-loader: certificado nao encontrado no .pfx');
  return { pemKey, pemCert };
}

/**
 * Le o nome do titular e a validade do certificado (para diagnostico).
 */
function metadados(pemCert) {
  const cert = forge.pki.certificateFromPem(pemCert);
  const cn = cert.subject.getField('CN');
  return {
    titular: cn ? cn.value : null,
    notAfter: cert.validity.notAfter.toISOString(),
  };
}

/**
 * Carrega o certificado A1 (cache de 5 min). Retorna { pemKey, pemCert,
 * titular, notAfter, version }.
 */
async function loadCertificado(force = false) {
  if (!force && cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;

  const certPath = `projects/${CERT_PROJECT}/secrets/${SECRET_CERT}/versions/latest`;
  const passPath = `projects/${CERT_PROJECT}/secrets/${SECRET_PASS}/versions/latest`;

  const [certResp] = await client.accessSecretVersion({ name: certPath });
  const [passResp] = await client.accessSecretVersion({ name: passPath });

  const pfxBuffer = Buffer.from(certResp.payload.data);
  const password = passResp.payload.data.toString('utf-8').trim();

  if (pfxBuffer.length < 100)
    throw new Error('cert-loader: secret sefaz-cert-a1 vazio ou invalido');

  const { pemKey, pemCert } = extrairPem(pfxBuffer, password);
  const meta = metadados(pemCert);

  cache = {
    pemKey, pemCert,
    titular: meta.titular,
    notAfter: meta.notAfter,
    version: certResp.name.split('/').pop(),
    loadedAt: Date.now(),
  };
  // Loga so metadados — nunca a senha nem o pfx.
  console.log(`[cert-loader] A1 carregado: titular=${meta.titular} validade=${meta.notAfter} version=${cache.version}`);
  return cache;
}

function invalidarCache() { cache = null; }

module.exports = { loadCertificado, invalidarCache };
